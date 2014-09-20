---
layout: post
title:  "Side effects of Kernel#Array"
date:   2014-01-23 07:32:40
author: "Jeroen Weeink"
description: "In Ruby, Kernel#Array converts any object to an Array. This works very well for most objects, but for some types of objects, it may not work as expected."
---
[`Kernel#Array`](http://devdocs.io/ruby/kernel#method-i-Array) converts an object to an Array by calling `to_ary` or `to_a` on the object passed into it. This works very well to convert most objects into an array:

{% highlight ruby %}
Array(5)       # => [5]
Array([1, 2])  # => [1, 2]
Array(nil)     # => []
{% endhighlight %}

But because of its mechanics, it doesn't work like this for all kinds of objects, which can lead to some unexpected surprises in some cases. Let's say you have an object or an array of objects and you only want the first value:

{% highlight ruby %}
object_or_array = Time.now

Array(object_or_array).first # => 52
{% endhighlight %}

`Kernel#Array` initially checks if the object respond to `to_ary`:

{% highlight ruby %}
Time.now.respond_to?(:to_ary) # => false
{% endhighlight %}

If not, it attempts to call `to_a` on the object. Some classes like `Time` and `Hash` implement a custom `to_a` method which doesn't wrap the original object itself into an array. `Time#to_a` instead returns an array of its components. Hence, in the above example, it returned the seconds instead if the whole `Time` object.

{% highlight ruby %}
Time.now.to_a # => [52, 13, 19, 22, 1, 2014, 3, 22, false, "UTC"]
{% endhighlight %}

Following the earlier example, if you do want to create an array containing the `Time` object and you're using Rails, you can use [`Array#wrap`](http://devdocs.io/rails/array#method-c-wrap), which doesn't call `to_a` on the argument:

{% highlight ruby %}
object_or_array = Time.now
Array.wrap(object_or_array).first # => Wed, 22 Jan 2014 19:13:22 UTC +00:00
{% endhighlight %}

In plain Ruby however, there's currently no elegant alternative.
