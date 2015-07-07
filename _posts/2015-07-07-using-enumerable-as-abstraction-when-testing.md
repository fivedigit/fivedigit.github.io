---
layout: post
title:  "Using Enumerable as testing abstraction"
date:   2015-07-07 22:14:00 UTC
author: "Jeroen Weeink"
description: "Enumerable is a very powerful Ruby module. Learn how it can be used for abstraction and simplifying tests as a result."
---
Let's say you want to import all Belgian beers from a beer export CSV and then save them to your database. After some quick hacking, something like this emerges:

    class BelgianBeerImport
      def initialize(io)
        @io = io
      end

      def import!
        CSV.parse(io.read, headers: true) do |row|
          next unless row[:country] == 'Belgium'

          Beer.create_from_import!(name: row[:name],
                                   brewery_name: row[:brewery],
                                   country_name: row[:country])
        end
      end
    end

There's even a test for this. Note how it's cleverly using a `StringIO` here to get the data in there without using a file:

    class BelgianBeerImportTest < ActiveSupport::TestCase
      def test_import_belgian_beers_from_csv
        io = StringIO.new(
          "name,brewery,country\n" \
          "Grimbergen Blonde,Brouwerij Alken-Maes,Belgium\n" \
          "Oatmeal Stout,Left Hand Brewing Company,United States\n" \
          "Grolsch Premium Weizen,Grolsche Bierbrouwerij,Netherlands\n" \
          "Straffe Hendrik Brugse,De Halve Maan,Belgium"
        )

        assert_difference('Beer.count', +2) do
          BelgianBeerImport.new(io).import!
        end

        # Or however something as complicated as this is tested...
        beer1, beer2 = Beer.last(2)

        assert_equal('Grimbergen Blonde', beer1.name)
        assert_equal('Brouwerij Alken-Maes', beer1.brewery_name)

        assert_equal('Straffe Hendrik Brugse', beer2.name)
        assert_equal('De Halve Maan', beer2.brewery_name)
      end
    end

This looks overly complicated though. The test is not only testing the `BelgianBeerImport` class, but also the `CSV` class and `ActiveRecord` itself. In fact, the tests are even hitting the database to verify that the system under test works.

The class is also restricted to importing CSV data. In fact, the test is supplying CSV data, adding another layer of complexity, since you need to provide *valid* CSV. One typo could ruin the beerfest, making this test rather brittle.

## Enumerable, the coolest Ruby module

`Enumerable` is awesome! I can go on about it for hours, but many others have already done it before me, so I'll skip on its basics.

The important part is that almost every Ruby developer knows its interface. `Array` and `Hash` are enumerable. So are `Set`, `Range`, `IO`, `StringIO`, `File` (IO is its parent), `Dir`, `CSV`, `Struct` and even more.

On each of these classes you can use the greatness that `Enumerable` provides:

    # Find all elements matching /apple/
    %w(apple pear banana pineapple).grep(/apple/)

    # List all file names in the current folder
    Dir.new('.').to_a

    # Get the longest line in a file, not counting surrounding whitespaces
    File.new('Gemfile').map(&:strip).max_by(&:length)

Great, so how does this help here?

Well, `CSV` is enumerable too. `BelgianBeerImport` should be refactored to take advantage of this fact. If we can abstract away from using CSV, it opens up interesting opportunities for our test and codebase.

    class BelgianBeerImport
      def initialize(io)
        @csv = CSV.new(io, headers: true)
      end

      def import!
        @csv.each do |row|
          next unless row[:country] == 'Belgium'

          Beer.create_from_import!(name: row[:name],
                                   brewery_name: row[:brewery],
                                   country_name: row[:country])
        end
      end
    end

Now we're creating an instance of `CSV` and using `each` to enumerate through the CSV row objects. The tests still pass so all is good!

This can be taken a lot further though. This test is still testing CSV and ActiveRecord. Let's inject them as dependencies:

    class BelgianBeerImport
      def initialize(csv, repository = Beer)
        @csv, @repository = csv, repository
      end

      def import!
        @csv.each do |row|
          next unless row[:country] == 'Belgium'

          @repository.create_from_import!(name: row[:name],
                                          brewery_name: row[:brewery],
                                          country_name: row[:country])
        end
      end
    end

The test has to be adjusted accordingly to pass in the CSV object:

    class BelgianBeerImportTest < ActiveSupport::TestCase
      def test_import_belgian_beers_from_csv
        io = StringIO.new(
          "name,brewery,country\n" \
          "Grimbergen Blonde,Brouwerij Alken-Maes,Belgium\n" \
          "Oatmeal Stout,Left Hand Brewing Company,United States\n" \
          "Grolsch Premium Weizen,Grolsche Bierbrouwerij,Netherlands\n" \
          "Straffe Hendrik Brugse,De Halve Maan,Belgium"
        )

        assert_difference('Beer.count', +2) do
          BelgianBeerImport.new(CSV.new(io, headers: true)).import!
        end

        # Or however something as complicated as this is tested...
        beer1, beer2 = Beer.last(2)

        assert_equal('Grimbergen Blonde', beer1.name)
        assert_equal('Brouwerij Alken-Maes', beer1.brewery_name)

        assert_equal('Straffe Hendrik Brugse', beer2.name)
        assert_equal('De Halve Maan', beer2.brewery_name)
      end
    end

It's time to have a good look at the `BelgianBeerImport` class and squeeze your eyes. If you stop thinking about `@csv` to be a `CSV` object and `row` to be a CSV row and think about it as an `Enumerable`, it suddenly looks an awful lot like an array containing hashes!

    class BelgianBeerImport
      def initialize(beers, repository = Beer)
        @beers, @repository = beers, repository
      end

      def import!
        @beers.each do |beer|
          next unless beer[:country] == 'Belgium'

          @repository.create_from_import!(name: beer[:name],
                                          brewery_name: beer[:brewery],
                                          country_name: beer[:country])
        end
      end
    end

It's simply renaming a few variables, but the new names make it a lot easier to see everything in a more abstract fashion.

Time to simplify the test, as the whole CSV part is no longer necessary. Instead we can supply a plain array (also enumerable) with hashes:

    class BelgianBeerImportTest < ActiveSupport::TestCase
      def test_import_belgian_beers_from_csv
        beers = [
          { name: 'Grimbergen Blonde', brewery: 'Brouwerij Alken-Maes',
            country: 'Belgium' },
          { name: 'Oatmeal Stout', brewery: 'Left Hand Brewing Company',
            country: 'United States' },
          { name: 'Grolsch Premium Weizen', brewery: 'Grolsche Bierbrouwerij',
            country: 'Netherlands' },
          { name: 'Straffe Hendrik Brugse', brewery: 'De Halve Maan',
            country: 'Belgium' }
        ]
        repository = mock

        repository.expects(:create_from_import!).with(name: 'Grimbergen Blonde',
          brewery_name: 'Brouwerij Alken-Maes', country_name: 'Belgium')
        repository.expects(:create_from_import!).with(name: 'Straffe Hendrik Brugse',
          brewery_name: 'De Halve Maan', country_name: 'Belgium')

        BelgianBeerImport.new(beers, repository).import!
      end
    end

Note how the ActiveRecord dependency got replaced with a simple mock and expectations.

Let's take a bit more advantage of the enumerable interface and be more explicit that we're expecting the enumerable to contain hashes:

    class BelgianBeerImport
      def initialize(beers, repository = Beer)
        @beers, @repository = beers, repository
      end

      def import!
        @beers
          .map(&:to_hash)
          .select { |beer| beer[:country] == 'Belgium' }
          .each { |beer| create_beer(beer) }
      end

      private

      def create_beer(beer)
        @repository.create_from_import!(name: beer[:name],
                                        brewery_name: beer[:brewery],
                                        country_name: beer[:country])
      end
    end

A CSV row object also has a `to_hash` method, which converts the row to a real hash. Now it's obvious what type of values we're working with. It also allows the enumerable to contain objects that aren't hashes, as long as they define the `to_hash` method and return the data in the required format.

## Conclusion

the `BelgianBeerImport` class has become a lot more flexible. It doesn't depend on CSV data alone anymore. Instead it has been abstracted into accepting any `Enumerable` whose values define `to_hash`.

The class has been completely decoupled from other dependencies. Mostly thanks to `Enumerable`! It's less complex, and therefore a lot easier to test. As a bonus, the test is blazing fast. Be sure not to blink when running tests like this, otherwise you'll think it hasn't even run!

Combined with duck typing, `Enumerable` is a very powerful interface. The fact that many Ruby developers are already familiar with its interface make it the ideal candidate to use for collection interfaces.
