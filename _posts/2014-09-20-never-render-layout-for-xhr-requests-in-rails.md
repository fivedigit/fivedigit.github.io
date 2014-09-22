---
layout: post
title:  "Never render layout for XHR requests in Rails"
date:   2014-09-20 18:00:00
author: "Jeroen Weeink"
description: "Never render the layout for XHR requests in Ruby on Rails, but still keep inheritance lookups enabled."
---

In Ruby on Rails, it's easy to set the application-wide default to never render a layout in response to XHR requests. Just include this single line in your `ApplicationController`:

    class ApplicationController < ActionController::Base
      layout proc { false if request.xhr? }
    end

This way, Rails will also [still use inheritance to look up the layout to render for the controller handling the request][1].

  [1]: http://guides.rubyonrails.org/layouts_and_rendering.html#rendering-by-default-convention-over-configuration-in-action
