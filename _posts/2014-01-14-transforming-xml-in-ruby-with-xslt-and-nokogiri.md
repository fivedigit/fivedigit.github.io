---
layout: post
title:  "Transforming XML in Ruby with XSLT and Nokogiri"
date:   2014-01-14 18:30:33
author: "Jeroen Weeink"
tags:   xml ruby nokogiri xslt
---
Nokogiri is a full-featured XML and HTML parser and builder. It also allows you to search XML and HTML documents with CSS and XPath selectors. You can also use it to transform XML documents into some other format using XSLT templates.

First, make sure you have the [Nokogiri gem installed](http://nokogiri.org/tutorials/installing_nokogiri.html).

Next, create XML document and XSLT template objects:

    require 'nokogiri'

    document = Nokogiri::XML(File.read('input.xml'))
    template   = Nokogiri::XSLT(File.read('template.xslt'))

    transformed_document = template.transform(document)

Then simply pass the XML document into the template's `transform` method. It returns the transformed document which you can use for further transforming or processing, or you could simply write the output to a file:

    File.open('output.html', 'w').write(transformed_document)
