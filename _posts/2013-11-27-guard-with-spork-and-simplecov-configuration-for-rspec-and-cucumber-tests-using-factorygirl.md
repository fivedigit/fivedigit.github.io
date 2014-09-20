---
layout: post
title:  "Guard with Spork and Simplecov configuration for RSpec and Cucumber tests using FactoryGirl"
date:   2013-11-27 23:09:24
author: "Jeroen Weeink"
description: "A test configuration for Rails 4 with Guard + Spork + Simplecov for combined reports with RSpec and Cucumber using FactoryGirl fixtures"
---
This test configuration uses Guard with Spork for running tests fast. It generates combined Simplecov code coverage reports for RSpec and Cucumber tests. It turns off garbage collection while running RSpec examples for increased performance. It uses FactoryGirl as a fixtures replacement.

It's primarily meant for use with Rails 4. The Gemfile includes several useful development gems.

<script src="https://gist.github.com/fivedigit/7684511.js"></script>
