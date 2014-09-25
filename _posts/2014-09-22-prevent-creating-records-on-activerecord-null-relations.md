---
layout: post
title:  "Prevent creating records on ActiveRecord null relations"
date:   2014-09-22 22:02:00 UTC
author: "Jeroen Weeink"
description: "Null relations in ActiveRecord can be useful, but they won't prevent all communication to the database. There is a workaround however!"
---

In some cases, you want an object that behaves like an ActiveRecord relation but does not contain any objects. In Rails 4, you can call `none` on a relation and it returns an empty relation:

    current_user.comments.none
    # => #<ActiveRecord::AssociationRelation []>

This is an implementation of the null object design pattern. It behaves like a relation, but it never queries the database.

Imagine a site where only registered users can leave comments, but every page lists your most recent comments in the sidebar. We could of course check in the view whether or not a user is logged in, but in this case we'll implement a `Guest` class which represents a non-registered user of the site. A registered user `has_many :comments`, so we need to simulate this on our `Guest`:

    class Guest
      def comments
        Comment.none
      end
    end

Cool, so now we can pretend we're dealing with a regular user in our views! `current_user` returns our guest if the user is not logged in:

    current_user.comments
    # => #<ActiveRecord::AssociationRelation []>

Without having to worry about guest users in the view ever again, the website ran happily ever after. That is, until the server logs started reporting errors:

> PG::NotNullViolation: ERROR:  null value in column "user_id" violates not-null constraint

The error seems to originate from a piece of controller code where comments are being created:

    current_user.comments.create(comment_params)

As it turns out, our null relation doesn't contain any objects, but we can still use it to create new records!

This happens because of the way the null relation works. When diving into the Rails code, `NullRelation` turns out to be a module which defines several methods like `count`, `update_all`, and `pluck` which always return empty values.

The `none` method of a relation looks like this:

    def none
      extending(NullRelation)
    end

The `extending` method extends *only* this instance with the given modules. This overrides all methods in the relation which are also defined in `NullRelation`. But since `create` hasn't been defined in `NullRelation`, it can still be used.

We can also make use of the `extending` method to create a true null relation in our `Guest` class. It also takes a block, which we will use to define a create method:

    class Guest
      def comments
        Comment.none.extending do
          def create(*args)
            new(*args).tap do |record|
              record.errors.add(:base, 'Guests cannot add comments')
            end
          end

          def create!(*args)
            raise ActiveRecord::RecordInvalid, create(*args)
          end
        end
      end
    end

Now when a guest attempts to add a new comment, a comment object is indeed initialized, but not persisted. In addition, we follow the `ActiveModel` behaviour and add a validation error:

    current_user.comments.create.errors.full_messages
    # => ["Guests cannot add comments"]

The controller and views won't need to handle the guest user any different now for adding comments, since this approach follows the Rails way quite nicely.
