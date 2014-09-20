---
layout: post
title:  "Transforming XML in Ruby with XSLT and Nokogiri"
date:   2014-01-14 18:30:33
author: "Jeroen Weeink"
description: "Nokogiri is a full-featured XML and HTML parser and builder. Here's how to transform XML using an XSLT template with a small snippet of code."
---
Nokogiri is a full-featured XML and HTML parser and builder. It also allows you to search XML and HTML documents with CSS and XPath selectors. You can also use it to transform XML documents into some other format using XSLT templates.

First, make sure you have the [Nokogiri gem installed](http://nokogiri.org/tutorials/installing_nokogiri.html).

Next, create XML document and XSLT template objects:

{% highlight ruby %}
require 'nokogiri'

document = Nokogiri::XML(File.read('input.xml'))
template = Nokogiri::XSLT(File.read('template.xslt'))

transformed_document = template.transform(document)
{% endhighlight %}

Then simply pass the XML document into the template's `transform` method. It returns the transformed document which you can use for further transforming or processing, or you could simply write the output to a file:

{% highlight ruby %}
File.open('output.html', 'w').write(transformed_document)
{% endhighlight %}