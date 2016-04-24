---
layout: post
title:  "Rendering XML with Haml"
date:   2013-02-17 09:44:57 UTC
author: "Jeroen Weeink"
description: "Everyone knows how to render standard HTML views in Rails with Haml, but rendering XML views using Haml is just as easy, if not easier!"
redirect_from: /2013/02/17/rendering-xml-with-haml.html
---
Haml makes it incredibly easy to render your HTML views. It's cleaner than HTML because it relies on indentation to define the element tree structure rather than closing tags.

But it's also very easy to render XML documents with Haml. In fact, it's just as easy as doing your other Haml views!

Look at this Haml code:

    !!! XML
    %items
      %item{id: 1}
        %name Item 1
        %description First Item

This renders the following XML:

    <?xml version='1.0' encoding='utf-8' ?>
    <items>
      <item id="1">
        <name>Item 1</name>
        <description>First Item</description>
      </item>
    </items>

So yeah, `!!! XML` renders an XML Doctype and tells Haml we're rendering XML. And that's all. Though if you want to render using a different encoding than the default UTF-8, you can specify this in the Doctype as well:

    !!! XML iso-8859-1

Which renders:

    <?xml version='1.0' encoding='iso-8859-1' ?>

The Haml documentation is exactly right when it says Haml is beautiful, rendering your XML is a breeze!
