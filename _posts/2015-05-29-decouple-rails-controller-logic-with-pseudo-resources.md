---
layout: post
title:  "Decouple logic from Rails controllers with Pseudo Resources"
date:   2015-05-29 16:52:00 UTC
author: "Jeroen Weeink"
description: "Non-resourceful controllers quickly become bloated and complex. Learn how to decouple them from their logic by making them resourceful!"
---
A common practice in Ruby on Rails applications is to have a `HomeController` to render the homepage, which doesn't directly translate into a resource.

Let's say we've got a video sharing application, and its homepage needs to display some fancy information about the way the website works. Such a static page doesn't really need a complicated controller at all:

    class HomeController < ApplicationController
      def show
        respond_to(:html)
      end
    end

More can be done with the homepage than just displaying some info. We'd like to display daily picked videos on the homepage. Easy one, just add a line to the controller:

    class HomeController < ApplicationController
      def show
        @todays_picks = Video.todays_picks.limit(6)

        respond_to(:html)
      end
    end

To stay up to date with ongoing trends, users also have to be able to view the most watched videos:

    class HomeController < ApplicationController
      def show
        @todays_picks = Video.todays_picks.limit(6)
        @most_watched = Video.most_watched.limit(6)

        respond_to(:html)
      end
    end

Since everyone loves to watch crazy cat videos all day, we'll feature them on the homepage too:

    class HomeController < ApplicationController
      def show
        @todays_picks = Video.todays_picks.limit(6)
        @most_watched = Video.most_watched.limit(6)
        @cats         = Video.with_funny_cats.limit(6)

        respond_to(:html)
      end
    end

It appears a lot of users visit the homepage very frequently, but the content on the homepage doesn't change as much. Let's add a performance improvement to make sure those returning visitors can load the page from their browser cache rather than fetching it again:

    class HomeController < ApplicationController
      def show
        @todays_picks = Video.todays_picks.limit(6)
        @most_watched = Video.most_watched.limit(6)
        @cats         = Video.with_funny_cats.limit(6)

        return unless stale?(
          last_modified: [
            @todays_picks.maximum(:updated_at),
            @most_watched.maximum(:updated_at),
            @cats.maximum(:updated_at)
          ].max,
          etag: [
            @todays_picks.ids,
            @most_watched.ids,
            @cats.ids
          ].join('-')
        )

        respond_to(:html)
      end
    end

The controller quickly becomes bloated and complicated. Because all the logic is embedded in the controller, it's very difficult to test. Since many instance variables are used, the interface between the controller and view is unclear and prone to changes. Future requirements might include something more complex than we've done so far, such as personal video recommendations. If the controller continues to grow the same way, the controller tests will surely become a living nightmare.

Sandi Metz once introduced [rules for Ruby developers][1], one of which states that controllers instantiate a single object and views can only know about a single instance variable. In its current state, the controller clearly violates that rule.

The problem is that there's not really a clear resource to use for the homepage, after all we're displaying so many different kinds of videos on there. But to follow Ruby on Rails conventions, we can introduce a "pseudo resource", which meets the minimal requirements to play nice with our controller the way Rails expects it to. The view can then use that single object instead of accessing many different instance variables.

We can consider the home to be a resource by itself. Since there's only one homepage, it would be a singular resource. We can be implement the `Home` resource as a PORO (Plain Old Ruby Object):

    class Home
      def cache_key
        "home/#{to_param}-#{updated_at.utc.to_s(:nsec)}"
      end

      def to_param
        @as_param ||= [
          todays_video_picks.ids,
          most_watched_videos.ids,
          cat_videos.ids
        ].join('-')
      end

      def updated_at
        @max_updated_at ||= [
          todays_video_picks.maximum(:updated_at),
          most_watched_videos.maximum(:updated_at),
          cat_videos.maximum(:updated_at)
        ].max
      end

      def todays_video_picks
        Video.todays_picks.limit(6)
      end

      def most_watched_videos
        Video.most_watched.limit(6)
      end

      def cat_videos
        Video.with_funny_cats.limit(6)
      end
    end

Since I don't use these kind of objects frequently at all, I'd just place this class inside the models folder rather than label it as something like an "action object".

Note that the instance variables which were previously in the controller have been moved to methods in the `Home` class. The view can now simply access those methods instead.

Both the `cache_key` and `updated_at` methods are used for the [conditional GET][2] we already had in the controller, but now the complexity of it is hidden from the controller. Now that we've moved the logic outside our controller, the controller itself becomes very simple:

    class HomeController < ApplicationController
      def show
        @home = Home.new

        respond_to(:html) if stale?(@home)
      end
    end

Quite a difference! Now the controller is focused purely on its responsibilities.

By the way, the `cache_key` method is also useful for the view. Since the `cache` view helper will attempt to call `cache_key` on the object we pass in, it can be used to cache the homepage contents in a way consistent with the conditional GET in the controller:

    <% cache(@home) do %>
      <%= render(@home.todays_video_picks) %>
      <%= render(@home.most_watched_videos) %>
      <%= render(@home.cat_videos) %>
    <% end %>

This is a great way to decouple the logic of the homepage from our controller completely. Now, it's much easier to test both the controller and the homepage logic in isolation. When new homepage requirements come along, the changes will happen inside the `Home` class and the view, the controller most likely won't even change at all.

[1]: https://robots.thoughtbot.com/sandi-metz-rules-for-developers
[2]: https://guides.rubyonrails.org/caching_with_rails.html#conditional-get-support
