---
layout: post
title:  "Cleaner RSpec examples and failure messages"
date:   2015-12-15 07:20:00 UTC
author: "Jeroen Weeink"
description: "RSpec comes with a lot of flexibility. It can become a disadvantage if examples grow complex. Read this post to learn how to keep your RSpec simple."
---
RSpec offers an extensive, flexible DSL to write your tests. But due to its extensive arsenal of matchers, RSpec requires some more effort to use properly than some other testing frameworks like Minitest.

Have a look at the following spec:

<pre><code class="ruby">
RSpec.describe ShoppingCart, type: :model do
  let(:shopping_cart) { subject }

  describe '#to_order' do
    let(:product1) { create(:product, price: 10) }
    let(:product2) { create(:product, price: 3) }
    let(:user) { create(:user) }

    before do
      shopping_cart.insert(product1, quantity: 2)
      shopping_cart.insert(product2)
    end

    it 'has the correct attributes' do
      order = shopping_cart.to_order(user)

      expect(order.price).to eq(23)
      expect(order.user).to eq(user)
    end

    it 'adds the products to the order' do
      line_items = shopping_cart.to_order(user).line_items

      expect(line_items[0].product).to eq(product1)
      expect(line_items[0].quantity).to eq(2)
      expect(line_items[1].product).to eq(product2)
      expect(line_items[1].quantity).to eq(1)
    end
  end
end
</code></pre>

It kind of gets the job done, but it's not super easy to read. It doesn't really feel like the RSpec way of doing it, especially not with those local variable assignments. Lastly, it forces a specific sorting order of line items in the last example. I'm absolutely not a fan of enforcing unnecessary implementation details as a side-effect.

## Built-in matchers
RSpec comes with a whole bunch of built-in matchers for your expectations. Its documentation extensively describes the [built-in matchers](https://www.relishapp.com/rspec/rspec-expectations/docs/built-in-matchers) and [argument matchers](https://relishapp.com/rspec/rspec-mocks/docs/setting-constraints/matching-arguments).

These matchers can be used in a lot of different situations. One that would come in handy here is [`have_attributes`](https://www.relishapp.com/rspec/rspec-expectations/docs/built-in-matchers/have-attributes-matcher) and its alias `an_object_having_attributes`:

<pre><code class="ruby">
RSpec.describe ShoppingCart, type: :model do
  let(:shopping_cart) { subject }

  describe '#to_order' do
    let(:product1) { create(:product, price: 10) }
    let(:product2) { create(:product, price: 3) }
    let(:user) { create(:user) }

    before do
      shopping_cart.insert(product1, quantity: 2)
      shopping_cart.insert(product2)
    end

    it 'has the correct attributes' do
      expect(shopping_cart.to_order(user))
        .to have_attributes(price: 23, user: user)
    end

    it 'adds the products to the order' do
      expect(shopping_cart.to_order(user).line_items).to contain_exactly(
        an_object_having_attributes(product: product1, quantity: 2),
        an_object_having_attributes(product: product2, quantity: 1)
      )
    end
  end
end
</code></pre>

Now the sort order of the line items became irrelevant thanks to [`contain_exactly`](https://www.relishapp.com/rspec/rspec-expectations/docs/built-in-matchers/contain-exactly-matcher).

Using the appropriate matchers can make a spec almost read like human language. There's not really a lot of logic involved that needs to be understood to figure out what the examples do.

Another nice resource is [this list of available matchers in RSpec 3 and their aliases](https://gist.github.com/JunichiIto/f603d3fbfcf99b914f86).

## Cleaner failure messages
A great disadvantage of using a matcher like `have_attributes` is that combined with ActiveRecord objects, it can easily fill your whole screen with a single failure message, printing out only a few objects:

<pre>
Failures:

1) ShoppingCart#to_order adds the products to the order
   Failure/Error: expect(shopping_cart.to_order(user).line_items).to contain_exactly(
     expected collection contained:  [(an object having attributes {:product => #<Product id: 1, name: "Product #3", price: 10, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">, :quantity => 2}), (an object having attributes {:product => #<Product id: 2, name: "Product #4", price: 3, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">, :quantity => 1})]
     actual collection contained:    [#<LineItem id: 1, product_id: 1, order_id: 1, quantity: 1, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">, #<LineItem id: 2, product_id: 2, order_id: 1, quantity: 1, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">]
     the missing elements were:      [(an object having attributes {:product => #<Product id: 1, name: "Product #3", price: 10, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">, :quantity => 2})]
     the extra elements were:        [#<LineItem id: 1, product_id: 1, order_id: 1, quantity: 1, created_at: "2015-12-14 22:42:05", updated_at: "2015-12-14 22:42:05">]
   # ./spec/models/shopping_cart_spec.rb:22:in `block (3 levels) in <top (required)>'
</pre>

This kind of spam is ridiculous. Most of this information we don't care about, and it's only distracting from what does matter.

One option would be to modify the objects being checked in a way to produce simpler failure messages, such as below:

<pre><code class="ruby">
it 'adds the products to the order' do
  line_items = shopping_cart.to_order(user).line_items.map do |item|
    item.slice(:product, :quantity)
  end

  expect(line_items).to contain_exactly(
    { 'product' => product1, 'quantity' => 2 },
    { 'product' => product2, 'quantity' => 1 }
  )
end
</code></pre>

I'm not a fan of this approach at all. It simplifies the failure message, but it complicates the spec by adding logic. Every time you read the spec, you need to wade through this logic to understand the examples.

It's actually quite easy to customize the way objects are being printed without having to compromise conciseness of the specs. Simply by overriding the `inspect` method you can alter the output of objects in a failure message:

    class LineItem < ActiveRecord::Base
      belongs_to :product
      belongs_to :order

      def inspect
        "#{quantity} x #{product.inspect}"
      end
    end

    class Product < ActiveRecord::Base
      def inspect
        name
      end
    end

With the irrelevant noise removed the failure message now becomes readable:

<pre>
Failures:

1) ShoppingCart#to_order adds the products to the order
 Failure/Error: expect(shopping_cart.to_order(user).line_items).to contain_exactly(
   expected collection contained:  [(an object having attributes {:product => Product #3, :quantity => 2}), (an object having attributes {:product => Product #4, :quantity => 1})]
   actual collection contained:    [1 x Product #3, 1 x Product #4]
   the missing elements were:      [(an object having attributes {:product => Product #3, :quantity => 2})]
   the extra elements were:        [1 x Product #3]
 # ./spec/models/shopping_cart_spec.rb:22:in `block (3 levels) in <top (required)>'
 </pre>

If you rely heavily on inspecting objects using `pp`, this approach might not be convenient since it will overwrite the pretty print output with the custom `inspect` output. For custom objects, you can easily override `pretty_print` to have `pp` print a more detailed output if you need it:

    class SomeObject
      def inspect
        'Test'
      end

      def pretty_print(pp)
        pp.pp_object(self)
      end
    end

For ActiveRecord objects however, this doesn't produce great output. There's not really a nice way around it, the best I found is to override a private method to have ActiveRecord print out the useful output it did before:

    class SomeObject < ActiveRecord::Base
      def inspect
        'Test'
      end

      private

      def custom_inspect_method_defined?
        false
      end
    end

## Conclusion
Being more aware of the matchers RSpec offers, it allows you to write clean, concise and elegant examples. It's worth taking a moment to browse the available matchers from time to time. After writing an example, take a step back and wonder if there's a better way to write it. After some time you become aware of a lot more possibilities write cleaner specs, and thus reduce their complexity.

The full source project for the code above can be found [on this Github repository](https://github.com/fivedigit/rspec_matchers).

What are your favourite RSpec matchers? Let me know in the comments down below!
