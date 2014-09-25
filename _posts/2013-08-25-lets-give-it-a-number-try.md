---
layout: post
title:  "Let's give it a #try"
date:   2013-08-25 13:11:10 UTC
author: "Jeroen Weeink"
description: "Read how Rails' try method can be very helpful against the cluttering presence checks."
---
A frequent bit of code seen throughout applications looks like this:

    shopping_cart && shopping_cart.items

Or another snippet including an `if` statement to verify the presence of a user:

    name = nil

    if user && user.profile
      name = user.profile.full_name
    end

Even though this code looks quite minimal, Rails makes it even easier by providing a method called `try`. Here's how it works:

    shopping_cart.try(:items)

`try` only calls the `items` method if `shopping_cart` responds to `items`. If it's `nil`, it doesn't respond to the items method, and `nil` is returned. There's also a `try!` method, which raises a `NoMethodError` if `shopping_cart` is not `nil` and does not respond to `items`.

Note that below Rails 4.0, `try` has the behaviour of `try!`, so it raises a `NoMethodError` if `shopping_cart` does not define the method being called.

The nice thing about `try` is that the `nil` object also implements this methods, which always returns `nil`. This means we can chain the `try` method to make things a lot easier! Take a look at how we can radically reduce the second example:

    name = user.try(:profile).try(:full_name)

Nice. It makes the code more readable. Arguments can easily be passed along with the call to `try`:

    product.try(:price, currency)

Do make sure you pass the correct number of arguments. Otherwise you'll get an `ArgumentError`, `try` won't be handling this for you.

If you pass a block to `try`, the block is passed along to the method being called:

    pictures.try(:each) do |picture|
      print(picture)
    end

If `pictures` is `nil`,  the tried method isn't called, and therefore the block won't be called either.

In a nutshell, this is what `try` does. It's also well documented [on the Rails documentation website](http://api.rubyonrails.org/classes/Object.html#method-i-try).
