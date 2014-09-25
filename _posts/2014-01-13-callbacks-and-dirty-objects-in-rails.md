---
layout: post
title:  "Callbacks and Dirty Objects in Rails"
date:   2014-01-13 22:37:31 UTC
author: "Jeroen Weeink"
description: "ActiveModel::Dirty tracks changes made to model attributes, useful inside ActiveRecord callbacks. The dirty work done for you keeps your code clean!"
---
`ActiveModel::Dirty` is responsible for tracking the changes to attributes in an active model. This often comes in handy with ActiveRecord callbacks to perform certain actions only if some attribute's value changed.

Imagine we have a `Comment` model which is flagged edited whenever its content changes:

    class Comment < ActiveRecord::Base
      before_update :set_edited, if: content_changed?

      validates :content, presence: true

      def set_edited
        write_attribute(:edited, true)
      end
    end

ActiveModel defines magic methods for each attribute to see if they changed. For `content`, it's `content_changed?`. The `content` attribute is now dirty. Whenever the record is saved, the new content is persisted to the database.

A new requirement comes up. We have to store the previous value of the comment in the `previous_content` attribute if the comment has been edited. Luckily Rails makes this a breeze:

    class Comment < ActiveRecord::Base
      before_update :set_edited, :set_previous_content, if: content_changed?

      validates :content, presence: true

      def set_edited
        write_attribute(:edited, true)
      end

      def set_previous_content
        write_attribute(:previous_content, content_was)
      end
    end

Note how `content_was` is called. Like `content_changed?` this is another magic method in `ActiveModel::Dirty`. It returns the previous value of `content`, or the current value if the content hasn't been changed. No need to store the old value inside some instance variable, the dirty work has already been done for you!
