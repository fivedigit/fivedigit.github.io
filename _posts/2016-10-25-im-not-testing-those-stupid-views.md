---
layout: post
title:  "I'm not testing those stupid views!"
date:   2016-10-25
author: "Jeroen Weeink"
description: "Rails views can evolve into a complex mix of HTML and Ruby conditionals. Avoid writing complex tests by keeping views stupid."
---
Over the course of a Rails project, views that started out very simple can evolve into a complex mix of HTML with complicated nested Ruby conditionals. They become hard to understand, hard to read and hard to work with. Fixing an edge case in those views may involve the painstaking process of writing of an end-to-end test to ensure the bug has been squashed. Those kind of tests have quite an impact on the overall runtime of the test suite, so typically you don't want to write too many of them. Especially not for edge cases. The more end-to-end tests you have, the harder it becomes to make changes to your views because the tests have all kinds of expectations of them.

Keeping views as stupid as possible is important. The complicated logic in views is hard to test because you need need to think a lot about things like HTML, clicking buttons and CSS selectors.

A simple solution to the problem is to move the logic into separate classes. Logic in separate classes can easily be unit tested. Unit tests run fast and are the cheapest kind of tests to write.

Consider this contrived example of a view with a bit of complex logic:

    <div class="checkout">
      <% if @order.line_items.count > 0 %>
        <% if (@order.total - @order.paid) > 0 %>
          <div class="outstanding-amount"><%= number_to_currency(@order.total - @order.paid) %></div>
        <% end %>
        <div class="all-the-line-items"></div>

        <% if @order.cancelled_at.nil? && (@order.total - @order.paid) > 0 %>
          <%= link_to "Cancel your order", cancel_order_path(@order) %>
        <% end %>
      <% else %>
        Your order is empty!
      <% end %>
    </div>

You need to think in order to understand what's going on here. Especially that `if` condition may keeps you occupied for a while.

In Rails projects the obvious candidates to move the logic to are the view decorators. Try to move only the logic and keep HTML rendering out of the decorators as much as possible. Writing tests for rendered HTML is a lot harder than writing a test for a simple return value.

One decorator doesn't necessarily need to be the container for all the logic. You can create a decorator for only a single page or a specific section of the page. A decorator can also delegate the logic to other classes that aren't decorators. I've written more about splitting up decorators in [Rails Anti-Pattern: Fat Decorator]({% post_url 2015-12-19-rails-antipattern-fat-decorator %}).

For the above view, such a decorator may look like this:

    class OrderDecorator < Draper::Decorator
      delegate_all

      def checkout_possible?
        line_items.count > 0
      end

      def can_be_cancelled?
        cancelled_at.nil? && !complete?
      end

      def complete?
        unpaid == 0
      end

      def unpaid
        total - paid
      end
    end

Once the logic has been extracted into a decorator, the view became more pleasant to read:

    <div class="checkout">
      <% if @order.checkout_possible? %>
        <% unless @order.complete? %>
          <div class="outstanding-amount">$ <%= number_to_currency(@order.unpaid) %></div>
        <% end %>
        <div class="all-the-line-items"></div>

        <% unless @order.can_be_cancelled? %>
          <%= link_to "Cancel your order", cancel_order_path(@order) %>
        <% end %>
      <% else %>
        Your order is empty!
      <% end %>
    </div>

Once the views become completely obvious there's hardly a need to test any edge cases. Mistakes can be caught just as good by the naked eye rather. Time is saved by writing simple tests rather than complicated end-to-end tests. The test suite runs faster so your TDD cycle is hardly slowed down. Keeping your views stupid saves you some energy because you don't have to be vigilant all the time.
