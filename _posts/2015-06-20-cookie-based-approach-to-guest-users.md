---
layout: post
title:  "A cookie based approach to handling guest users"
date:   2015-06-20 18:55:57 UTC
author: "Jeroen Weeink"
description: "A database-less and polymorphic approach to handling guest users in Ruby on Rails using the cookie or session store."
---
Nithin Bekal [wrote an excellent post](http://nithinbekal.com/posts/gradual-engagement-rails/) on how to use gradual engagement in Ruby on Rails for guest users by allowing them to publish posts to a site without actually registering.

This post presents a database-less approach to handling guest users in Rails. It's not necessarily better than Nithin's approach, but the general idea is not to bother our database with guest users' data which eventually has to be cleaned up manually. There also should not be a special treatment for the guest users by the controllers, views and other models.

This leads to a cookie or session based approach to store a guest users' data. A cookie based approach means they cannot access the data from different devices. This leaves an incentive for them to actually register, while it's possible to try out the personalized functionality of the website. It's also a good option to have an expiration date on the cookie, so guests have to come back in order to keep their data.

## Basic Application Structure

The application is quite vanilla. Registered users can upload videos, and add videos to a watchlist to watch them at a later time. Watchlisted videos are represented by the `SavedVideo` model. Devise is used for registration and authentication.

    # app/models/user.rb
    class User < ActiveRecord::Base
      has_many :saved_videos

      devise :database_authenticatable, :registerable
    end

    # app/models/saved_video.rb
    class SavedVideo < ActiveRecord::Base
      belongs_to :video
      belongs_to :user

      scope :for_video, ->(video) { where(video: video) }
    end

Registered users can also view their watchlist. The `SavedVideosController` takes care of this and adding videos on the watchlist:

    # app/controllers/saved_videos_controller.rb
    class SavedVideosController < ApplicationController
      before_action :authenticate_user!

      def index
        @saved_videos = current_user.saved_videos

        respond_to(:html)
      end

      def create
        video = Video.find(params[:video_id])

        current_user.saved_videos.create!(video: video)
        flash.notice = 'Video saved for later.'

        respond_to do |format|
          format.html { redirect_to(videos_path) }
        end
      end
    end

The watchlist page looks like this:

    # app/views/saved_videos/index.html.slim
    .row
      .cols-xs-12
        h1 Saved Videos

        table.table.table-striped
          = render(@saved_videos) || 'No videos saved for later yet'

The saved video partial simply renders the video with an additional surrounding tag for styling purposes:

    # app/views/saved_videos/_saved_video.html.slim
    .saved-video
      = render(saved_video.video)

The video partial also has a link to add a video to the watchlist, or shows a label if a video is already saved for later:

    # app/views/videos/_video.html.slim
    .video
      h2 = video.name
      - if current_user.saved_videos.for_video(video).exists?
        span.label.label-primary On Watchlist
      - else
        a href=video_saved_video_path(video) data-method="post" Watch later

The page of all available videos looks like this when adding a video to the watchlist:

![List of videos and adding a video to the watchlist](/assets/guests/1.jpg)

## Refactoring User

Before moving on to the implementation of the guest user, the interface of the `User` model has to be simplified. Right now it looks rather complicated:

    current_user.saved_videos.for_video(video).exists?

    current_user.saved_videos.create!(video: video)

    current_user.saved_videos

The first two are using the ActiveRecord API. The guest user won't be having a database backend, so the ActiveRecord specific calls should be considered an implementation detail, and need to be encapsulated.

This leads to the following structure for `User`:

    class User < ActiveRecord::Base
      has_many :saved_videos

      devise :database_authenticatable, :registerable

      def saved_for_later?(video)
        saved_videos.for_video(video).exists?
      end

      def save_for_later(video)
        saved_videos.create!(video: video)
      end
    end

Communication with the user now happens through a few simple calls:

    current_user.saved_for_later?(video)

    current_user.save_for_later(video)

    current_user.saved_videos

Time to apply these changes to the controller:

    class SavedVideosController < ApplicationController
      before_action :authenticate_user!

      # ...

      def create
        video = Video.find(params[:video_id])

        current_user.save_for_later(video)
        flash.notice = 'Video saved for later.'

        respond_to do |format|
          format.html { redirect_to(videos_path) }
        end
      end
    end

And the video partial:

    .video
      h2 = video.name
      - if current_user.saved_for_later?(video)
        span.label.label-primary On Watchlist
      - else
        a href=video_saved_video_path(video) data-method="post" Watch later

To make sure guest users can actually access the saved video controller, the `before_action` call should be removed, otherwise they'll end up on the sign in page.

## Adding the Guest

Preparations have been made for the introduction of the guest user. Let's log out and see what happens when viewing the video listing:

    ActionView::Template::Error (undefined method `saved_for_later?' for nil:NilClass):
        2:   h2
        3:     = video.name
        4:     small<
        5:       - if current_user.saved_for_later?(video)
        6:         span.label.label-primary On Watchlist
        7:       - else
        8:         a href=video_saved_video_path(video) data-method="post" Watch later
      app/views/videos/_video.html.slim:5:in `_app_views_videos__video_html_slim__3946905160582581419_70363594171520'
      app/views/videos/index.html.slim:5:in `_app_views_videos_index_html_slim___3933902596725860868_70363542529440'
      app/controllers/videos_controller.rb:7:in `index'

Devise exposes the logged in user in a controller method called `current_user`. If the user is not authenticated, `current_user` simply returns `nil`, leading to the error. So instead of `nil`, it should return the guest user object.

Let's initially implement it as a Null Object. It won't do anything yet, but this is a useful way to see if we haven't missed anything else.

    class Guest
      def saved_for_later?(video)
        false
      end

      def save_for_later(video)
      end

      def saved_videos
        []
      end
    end

Override the `current_user` method in the controller to return the guest user when `nil` is returned:

    class ApplicationController < ActionController::Base
      def current_user
        super || guest_user
      end

      private

      def guest_user
        @guest ||= Guest.new
      end
    end

Let's check out the application again. Viewing and adding saved videos should work again. Note that when saving a video, it displays the flash message, but it doesn't actually add it to the watchlist yet.

![Testing with the null object](/assets/guests/2.jpg)

There's something else odd going on too. It displays the option to log out, but we're a guest user!

The default way in Devise to check if a user is signed in is with the `user_signed_in?` method. It simply checks the presence of a current user, so even the guest object would make it return true. The easiest fix is to override the `user_signed_in?` method, like so:

    class User < ActiveRecord::Base
      # ...

      def registered?
        true
      end
    end

    class Guest
      # ...

      def registered?
        false
      end
    end

    class ApplicationController < ActionController::Base
      # ...

      def user_signed_in?
        current_user.registered?
      end
    end

With that out of the way, it's time to store a guests' saved videos in a cookie!

    class Guest
      def initialize(store)
        @store = store
      end

      def registered?
        false
      end

      def saved_for_later?(video)
        saved_video_ids.include?(video.id)
      end

      def save_for_later(video)
        @store[:saved_for_later] = JSON.generate((saved_video_ids << video.id))
      end

      def saved_videos
        []
      end

      private

      def saved_video_ids
        return [] unless @store[:saved_for_later]

        JSON.parse(@store[:saved_for_later])
      end
    end

The cookie store is being passed into the initializer, and the ID's of saved videos are stored inside it in the JSON format. Since the cookie store is a very Hash-like object, the `Guest` actually doesn't really have to care that it's a cookie store, it just pretends it's a hash! This is useful when testing `Guest`, an actual `Hash` can be used:

    class GuestTest < MiniTest::Test
      def test_save_video_for_later
        store = {}
        video = mock
        guest = Guest.new(store)

        video.expects(:id).returns(23)
        guest.save_for_later(video)

        assert_equal(store, { saved_for_later: '[23]' })
      end
    end

In `ApplicationController`, a guest should now be initialized with a cookie store:

    class ApplicationController < ActionController::Base
      def user_signed_in?
        current_user.registered?
      end

      def current_user
        super || guest_user
      end

      private

      def guest_user
        @guest ||= Guest.new(cookies.signed)
      end
    end

Let's check out the changes made to the `SavedVideosController`:

    class SavedVideosController < ApplicationController
      # ...

      def create
        video = Video.find(params[:video_id])

        current_user.save_for_later(video)
        flash.notice = 'Video saved for later.'

        respond_to do |format|
          format.html { redirect_to(videos_path) }
        end
      end
    end

That's right, nothing changed! This is polymorphism at its best! The `create` action doesn't waste its time caring whether the user is a guest or not. The lack of conditionals greatly boosts the clarity of the controller action!

The only thing remaining is to display the videos on the watchlist. The `saved_videos` method of a user is expected to return an array-like structure with objects responding to the `user` and `video` methods. This is handled by returning a struct:

    class Guest
      # ...

      def saved_videos
        saved_video = Struct.new(:user, :video) do
          def to_partial_path
            SavedVideo.new.to_partial_path
          end
        end

        Video.where(id: saved_video_ids).map do |video|
          saved_video.new(self, video)
        end
      end

      private

      def saved_video_ids
        return [] unless @store[:saved_for_later]

        JSON.parse(@store[:saved_for_later])
      end
    end

Note that the struct also responds to `to_partial_path`, so that Rails knows which partial to render for the object. Let's see how it works:

![Guest user browsing the watchlist](/assets/guests/3.jpg)

Way cool! A guest user save videos the exact same way registered users can. This is nice to quickly try it out, without having to create an account first. After they register, everything still works the same, familiar way.

## Refactoring the Guest

Looking at the `Guest` class, all it really does is managing the saved videos:

    class Guest
      def initialize(store)
        @store = store
      end

      def registered?
        false
      end

      def saved_for_later?(video)
        saved_video_ids.include?(video.id)
      end

      def save_for_later(video)
        @store[:saved_for_later] = JSON.generate((saved_video_ids << video.id))
      end

      def saved_videos
        saved_video = Struct.new(:user, :video) do
          def to_partial_path
            SavedVideo.new.to_partial_path
          end
        end

        Video.where(id: saved_video_ids).map do |video|
          saved_video.new(self, video)
        end
      end

      private

      def saved_video_ids
        return [] unless @store[:saved_for_later]

        JSON.parse(@store[:saved_for_later])
      end
    end

If the guest were to do anything in addition, the class becomes bloated really quickly. Let's fast-forward a couple of refactorings to see a better structure:

    # app/models/guest.rb
    class Guest
      attr_reader :saved_videos

      def initialize(store)
        @saved_videos = Guests::SavedVideos.new(store)
      end

      def registered?
        false
      end

      def saved_for_later?(video)
        saved_videos.include?(video)
      end

      def save_for_later(video)
        return if saved_for_later?(video)

        saved_videos << video
      end
    end

`SavedVideos` just got its own, dedicated class. Note that it's located inside the `Guests` module. Here's the code:

    # app/models/guests/saved_videos.rb
    module Guests
      class SavedVideos
        include Enumerable

        delegate :each, to: :to_ary

        def initialize(store)
          @store = store
        end

        def include?(video)
          ids.include?(video.id)
        end

        def <<(video)
          @store[:saved_for_later] = JSON.generate(ids << video.id)
        end

        # Is called by ActionView when rendering a collection
        def to_ary
          Video.where(id: ids).map do |video|
            Guests::SavedVideo.new(self, video)
          end
        end

        private

        def ids
          return [] unless @store[:saved_for_later]

          JSON.parse(@store[:saved_for_later])
        end
      end
    end

The low level code of storing data inside the cookie store is in here. Take note of the `to_ary` method. The struct has been replaced with an actual class. `to_ary` is also called by ActionView when passing a collection to `render`.

`Guest` can treat `Guests::SavedVideos` as an array like object, not having to worry about all the implementation details. `Guests::SavedVideos` is also `Enumerable`, so it actually has a lot of methods arrays do too! This makes it easy to add a little count of saved videos on the website, simply by calling `current_user.saved_videos.count`!

## Next steps

You might want to add restrictions to the guest user, such as a maximum amount of saved videos. And when they exceed the maximum, present them with a register screen to continue saving more videos. I'll probably cover this in a future post.

When a guest decides to actually register, it makes sense to import their already saved data into the account as a courtesy.

Since cookies are transfered with every request to the web server, you might decide to store the data inside the session store. This can be accomplished by one simple change in the controller:

    class ApplicationController < ActionController::Base
      def current_user
        super || guest_user
      end

      private

      def guest_user
        @guest ||= Guest.new(session)
      end
    end

And that's where Rails shines, the session store has the same hash-like interface as a cookie store, making this change extremely simple!

You might also enable users to erase their data. On the `User`, it's easy enough to call `destroy` or `delete`. It's not too hard to implement this for the `Guest` too:

    class Guest
      # ...

      def destroy
        saved_videos.destroy
      end

      alias_method :delete, :destroy
    end

`Guests::SavedVideos` is then concerned with cleaning up only its own data:

    module Guests
      class SavedVideos
        # ...

        def destroy
          @store[:saved_for_later] = nil
        end
      end
    end

It doesn't fully remove the cookie, but it does clear the data. For whatever reason, you cannot call `delete` on a chained cookie...

## Conclusion

This approach works nicely when no guest user data has to be stored inside the database (and even if it does, this can work with a few adjustments!), and you're not storing a lot of data inside the cookie.

The greatest benefit in my opinion is that the application remains pretty much unchanged and the implementation details are nicely encapsulated by the `Guest` class.

Check out the [full source code on Github](https://github.com/fivedigit/cookie-based-guests)!