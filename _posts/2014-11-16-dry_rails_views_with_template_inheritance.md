---
layout: post
title:  "DRY Rails Views with Template Inheritance"
date:   2014-11-16 09:41:20 UTC
author: "Jeroen Weeink"
description: "Keeping Rails views DRY can sometimes be difficult when there are small differences between pages. Let's find the best way to keep views simple and DRY."
---

Keeping Rails views DRY can sometimes be difficult when there are small differences between pages. Let's find the best way to keep views simple and DRY.

## The Complicated Blog

Let's say we've got a blog with a search bar displayed in the header. When the user is on the search page however, the search bar must only be displayed on
top of the search results, not in the header.

But what is the most DRY way to accomplish this? One option would be to check if
the we're currently on the search page or not, and only display the search bar if we're not:

    %header
      - unless current_page?(search_path)
        = render 'search_bar'

Meh. This feels dirty. What if on the archive page we also want to hide the header search bar? Then we need to complicate the view by adding more logic:

    %header
      - unless current_page?(search_path) || current_page?(archive_path)
        = render 'search_bar'

We could utilize a helper here, but that's just sweeping the problem under the carpet. Another way is to use `content_for` and `yield`:

    %header
      = yield :search

Regardless of where we want to display the search bar, we never have to change the layout anymore. Just call `content_for` in the search view:

    - content_for :search do
      = render 'search_bar'
    / *snip* rest of view

But now we're bothering our search and archive views with the responsibility of rendering the search bar. This solution is still not ideal.

## Rails Template Inheritance

Before we can come up with a better solution, let's look at how Rails looks up view templates. This is closely related to the name of our controller. Let's have a look at our search controller:

    class SearchController < ApplicationController
    end

We know that Rails expects views for this controller to be in `app/views/search/`. But if Rails cannot find the view in this folder, it actually looks up the controller inheritance tree, and tries to find the views in `app/views/application/`.

This is also why the default layout is always called `application`. Rails uses inheritance to look up layouts as well. If we were to define a `search` layout, it would use that for our `SearchController` views instead.

But the relevant part is that Rails also uses this lookup mechanism for partials! Let's try to render a non-existing partial in our search view:

    = render 'test'

By looking at the error being raised, we can see how Rails looks up this template:

> ActionView::MissingTemplate - Missing partial search/_test, application/_test

So first it looks for the partial in search, then in application. We can use this mechanism to our advantage!

## Putting it together

In our layout, we can always render this partial:

    / app/views/layouts/application.html.haml
    %header
      = render 'search_bar'

Let's define a partial in application that renders the search bar:

    / app/views/application/_search_bar.html.haml
    = form_tag search_path, method: 'get' do
      = text_field_tag :q

Since Rails first looks for a `search/_search_bar` partial, we can override the default:

    / app/views/search/_search_bar.html.haml
    / Just an empty partial to hide the search bar!

Just providing an empty partial is enough to prevent rendering the search bar!

On our other pages, we don't have to do anything, it will just render the default search bar partial.

## Conclusion

View Template Inheritance is a very powerful mechanism. Instead of using it to hide some content, we can also use it to render different content in a partial without changing our layout.

It prevents having to do dirty if checks and having complicated logic cluttering our views. With template inheritance, we can utilize reusability in our Rails views.