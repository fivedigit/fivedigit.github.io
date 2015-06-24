---
layout: post
title:  "Say no to chained scopes!"
date:   2015-06-24 22:35:57 UTC
author: "Jeroen Weeink"
description: "Chaining ActiveRecord scopes outside their models resist change and testability. Fortunately, there's an easy solution!"
---
In a Ruby on Rails application, it's not uncommon to encounter code which reaches deep into the internals and database schema of a model.

    class Person < ActiveRecord::Base
      enum gender: { male: 1, female: 2 }
    end

    class PeopleController < ApplicationController
      def index
        @people = Person.where(gender: Person.genders[:male])
                        .where('age >= 18')
                        .where(right_handed: false)

        respond_to(:html)
      end
    end

This code has a few problems:

* The controller has way too much knowledge of the database structure of the model. Having these details bleeding into higher layers resists change to the underlying structure.
* The chain of method calls make it incredibly hard to test if you're using mocks.

These are implementation details which must be encapsulated within the model. ActiveRecord scopes to the rescue!

    class Person < ActiveRecord::Base
      enum gender: { male: 1, female: 2 }

      scope :male,        -> { where(gender: 1) }
      scope :adult,       -> { where('age >= 18') }
      scope :left_handed, -> { where(right_handed: false) }
    end

    class PeopleController < ApplicationController
      def index
        @people = Person.male.adult.left_handed

        respond_to(:html)
      end
    end

The raw SQL and knowledge of model attributes has been encapsulated inside the model. Problem solved ... right?

The testability has been slightly improved, but there's still a long chain of method calls to combine the different scopes. We still have to summon an army of mocks to test our controller:

    class PeopleControllerTest < ActionController::TestCase
      def test_people_index
        adult_finder        = mock
        left_handed_finder  = mock

        Person.expects(:male).returns(adult_finder)
        adult_finder.expects(:adult).returns(left_handed_finder)
        left_handed_finder.expects(:left_handed)

        get :index
        assert_response :success
      end
    end

Besides expectation ridden, the test is also quite brittle. If the order of scopes changes at some point, the test fails, even though the code being tested still works.

Another problem may arise with more complex scopes. Scopes can be combined freely, but not all combinations might lead to valid SQL. Testing all combinations is very cumbersome too.

I prefer to combine the scopes into a single scope or class method inside the model, rather than chaining scopes outside the model. This keeps as much internal as possible, and allows for easier database query optimizations and other changes.

    class Person < ActiveRecord::Base
      enum gender: { male: 1, female: 2 }

      scope :male,        -> { where(gender: 1) }
      scope :adult,       -> { where('age >= 18') }
      scope :left_handed, -> { where(right_handed: false) }

      class << self
        def left_handed_male_adults
          left_handed.male.adult
        end
      end
    end

    class PeopleController < ApplicationController
      def index
        @people = Person.left_handed_male_adults

        respond_to(:html)
      end
    end

The scope chain has been wrapped inside the `Person.left_handed_male_adults` class method. Note that the class method could also have been defined as a scope if you wanted to. The primary difference between the two is that a scope is guaranteed to return an ActiveRecord relation.

The combined scope leads to a much simpler and more robust test:

    class PeopleControllerTest < ActionController::TestCase
      def test_people_index
        Person.expects(:left_handed_male_adults)

        get :index
        assert_response :success
      end
    end

By avoiding the scope chains outside of the relevant models, the codebase becomes less coupled and therefore easier to maintain and refactor.

Of course it's still possible and very to chain the scopes since all scopes are public. Resist the urge of chaining them outside of their model to keep things simple!
