---
layout: post
title:  "Chaining named scope outside its model is a code smell"
date:   2015-05-28 20:15:57 UTC
author: "Jeroen Weeink"
description: ""
---

Named scopes are a very useful utility provided by ActiveRecord. It can be used to clean up controllers and views having too much knowledge about a model's internals:

where controllers reach deep into the implementation details and database schema knowledge:

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

These are details that must be encapsulated within the model itself. Right now, it's very hard to test the controller because of the embedded database interaction. Named scopes to the rescue:

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

This is already an improvement. The controller got rid of the raw SQL and implementation details of the model. But this can go even further, since we're still looking at a chained method call (violation of the Law of Demeter), which hasn't improved the testability of the controller much.

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

Although the Person

- Violation of the Law of Demeter
- Code outside a model reaches deep into the implementation
- Becomes very hard to refactor
- Difficult to optimise for performance
- Hard to test

