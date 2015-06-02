---
layout: post
title:  "Resourceful custom user profile theme"
date:   2015-06-02 18:10:00 UTC
author: "Jeroen Weeink"
description: "Learn how to build a solution to allow user-customizable profile themes in the way that works best in Ruby on Rails."
---
Imagine we've got a Rails application where users can view each other's profiles. We'd like to enable them to make their profile personal and unique by customizing the background and text colors used to display their profile. In nearby the future, there will likely be many more adjustments users can make to their profile theme. So what would be a good approach for this problem that conforms to the Rails way?

We've already got our `User` and `Profile` functionality in place, where a user can have a single profile:

    # app/models/user.rb
    class User
      has_one :profile
    end

    # app/models/profile.rb
    class Profile
      belongs_to :user
    end

And the controller to view other user's public profiles is quite vanilla too:

    # app/controllers/profiles_controller.rb
    class ProfilesController < ApplicationController
      def show
        @profile = User.find(params[:id]).profile

        respond_to(:html) if stale?(@profile)
      end
    end

And there's of course the profile view:

    <!-- app/views/profiles/show.html.erb -->
    <div class="profile">
      <h1><%= @profile.name %></h1>
      <p>Location: <%= @profile.location %></p>
    </div>

I won't go into the details of the form to edit the profile settings itself, but we'll store the color codes in two attributes on profile called `foreground_color` and `background_color`.

There are a couple of ways we can implement the profile theming:

## Inline styles

This is the fastest way to get it done, and also the fastest way to turn your frontend code into a tangled mess. A definite no-go unless you really like digital spaghetti.

## Including CSS in `<style>` tags

A little better, but not quite enough separated yet. Everything is still rendered within the same view. I don't feel like this is the most logical option, especially not in the longer run when the functionality expands.

## Rendering CSS in a stylesheet

This option makes the most sense to me. This keeps the data nicely separated from the styles, and doesn't throw everything on a single pile of code.

It's also a very resourceful approach. We're considering the stylesheet to be the *representation of a profile in CSS format*. This fits in nicely with the way Rails works, our controller only needs a minor change:

    class ProfilesController < ApplicationController
      def show
        @profile = User.find(params[:id]).profile

        respond_to(:html, :css) if stale?(@profile)
      end
    end

Next, the CSS view needs to be implemented:

    /* app/views/profiles/show.css.erb */
    .profile {
      background-color: <%= @profile.background_color %>
    }

    .profile p {
      color: <%= @profile.foreground_color %>
    }

Right now there are only two simple attributes, but when profile customization functionality extends, it might be a good idea to start using a decorator at some point.

So now that we've got our  stylesheet done, it needs to be included in the page to see the custom theme. We'll do this using `content_for` in the profile HTML view:

    <!-- app/views/profiles/show.html.erb -->
    <% content_for :stylesheet_includes do %>
      <%= stylesheet_link_tag(profile_path(@user, format: :css)) %>
    <% end %>

    <div class="profile">
      <h1><%= @profile.name %></h1>
      <p>Location: <%= @profile.location %></p>
    </div>

Finally, we'll render the `stylesheet_includes` content in the `<head>` of the page by adding a line to the application layout:

    <!-- app/views/layouts/application.html.erb -->
    <head>
      <%= yield :stylesheet_includes %>
    </head>

And that's it! If the user visits a profile, the stylesheet with the theme for that profile is applied to the page. This is a nice separation of concerns, made super easy by Ruby on Rails.