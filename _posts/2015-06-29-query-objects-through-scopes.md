---
layout: post
title:  "Delegating to Query Objects through ActiveRecord scopes"
date:   2015-06-29 21:10:57 UTC
author: "Jeroen Weeink"
description: "Query objects are a fairly well known concept in Rails. But how can you use a query object as an ActiveRecord scope?"
---
Query objects are a fairly well known concept in Rails these days. They're useful to extract complex SQL queries into their own classes, which would otherwise clutter ActiveRecord models. What if you turned a complex scope which is already used all over your application into a query object? Do you have to refactor all of these occurences?

The following ActiveRecord model has a scope returning popular featured videos. Okay, it's not really that complex, but this way we can keep the focus on the important parts.

    class Video < ActiveRecord::Base
      scope :featured_and_popular,
            -> { where(featured: true).where('views_count > ?', 100) }
    end

The scope can be easily extracted into a query object:

    module Videos
      class FeaturedAndPopularQuery
        def initialize(relation = Video.all)
          @relation = relation
        end

        def featured_and_popular
          @relation.where(featured: true).where('views_count > ?', 100)
        end
      end
    end

Instead of calling a scope on the model, now the query object can be called:

    Videos::FeaturedAndPopularQuery.new.featured_and_popular

While it's great to have the logic removed from the `Video` class, there are dozens of occurrences of `Video.featured_and_popular` calls scattered across the whole application. It would be great if the interface could remain unchanged, while still having the complex logic handled by the query object.

To find out how this can be done, let's first take a look at how Rails implements the `scope` method. Note that this is a bit simplified, I've left out the irrelevant parts:

    def scope(name, body, &block)
      unless body.respond_to?(:call)
        raise ArgumentError, 'The scope body needs to be callable.'
      end

      # ...

      singleton_class.send(:define_method, name) do |*args|
        scope = all.scoping { body.call(*args) }
        # ...

        scope || all
      end
    end

A couple of things catch the attention:

* The body (usually a proc) of the scope can be any object, as long as it responds to `call`.
* The `scoping` method is used to scope the result of the body to the current scope.

 So the `scoping` method makes sure that the relation being returned by the scope body is scoped to the relation in the current scope. Wait, that sounds confusing. Check out this example:

    Video.only_cats.scoping do
      Video.featured_and_popular
    end

This would return cat videos which are featured and popular. So `scoping` scopes the relation inside the block to the scope of `Video.only_cats`.

We can simply call the query object from the scope. Thanks to `scoping`, we don't need to pass the current scope into the query object:

    class Video < ActiveRecord::Base
      scope :featured_and_popular,
            -> { Videos::FeaturedAndPopularQuery.new.featured_and_popular }
    end

But this looks quite ugly and verbose.

As we've seen in the implementation of `scope`, it expects its body to be an object which responds to `call`. Right now we're passing a proc, but this can be replaced with the query object, as long as it responds to `call`. So we can just turn the query object into a callable object by renaming a method:

    module Videos
      class FeaturedAndPopularQuery
        def initialize(relation = Video.all)
          @relation = relation
        end

        def call
          @relation.where(featured: true).where('views_count > ?', 100)
        end
      end
    end

The proc can be removed from the scope declaration, and the query object itself becomes the scope body:

    class Video < ActiveRecord::Base
      scope :featured_and_popular, Videos::FeaturedAndPopularQuery.new
    end

We could take this even further. Since classes are also objects in Ruby, it's possible to have a class method `call`, which delegates the call to a new instance of the query object:

    module Videos
      class FeaturedAndPopularQuery
        class << self
          delegate :call, to: :new
        end

        def initialize(relation = Video.all)
          @relation = relation
        end

        def call
          @relation.where(featured: true).where('views_count > ?', 100)
        end
      end
    end

Now only the class has to be passed in as the body of the scope. Judging by the camelcased name, it's very obvious we're dealing with a class here.

    class Video < ActiveRecord::Base
      scope :featured_and_popular, Videos::FeaturedAndPopularQuery
    end  

The logic of the query has been extracted to a query object, but the scope has been left in place so other parts of the code don't need to be changed. The ActiveRecord model looks nice and clean, while the scope is essentially a delegation to the query object.
