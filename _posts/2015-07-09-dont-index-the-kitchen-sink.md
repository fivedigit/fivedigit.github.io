---
layout: post
title:  "Don't index the kitchen sink!"
date:   2015-07-09 13:13:00 UTC
author: "Jeroen Weeink"
description: "Learn how unnecessary indexes easily sneak into your Rails application, and what you can do about it."
---
I was recently cleaning up unused indexes and I found quite a few. These were mostly part of join models from which a reverse association wasn't required. Consider the following example:

    class ShoppingCart < ActiveRecord::Base
      has_many :shopping_cart_products
      has_many :products, through: :shopping_cart_products
    end

    class ShoppingCartProduct < ActiveRecord::Base
      belongs_to :shopping_cart
      belongs_to :product
    end

    class Product < ActiveRecord::Base
    end

A very basic design for shopping carts containing products.

The `ShoppingCartProduct` model has been created using Rails' model generator, which creates the model class with associations, as well as a migration:

> bin/rails g model CartProduct quantity:integer{1} user:belongs_to product:belongs_to --no-test-framework

    class CreateShoppingCartProducts < ActiveRecord::Migration
      def change
        create_table :shopping_cart_products do |t|
          t.integer :quantity, limit: 1, null: false
          t.belongs_to :shopping_cart, index: true, foreign_key: true
          t.belongs_to :product, index: true, foreign_key: true

          t.timestamps null: false
        end
      end
    end

As a good practice, the `quantity` column has been set to disallow null values. Note the two indexes on `shopping_cart_products` which were created by default.

It doesn't actually make a lot of sense to ever display which shopping carts a specific product is in. That means it's not necessary to be able to query a `ShoppingCartProduct` by its `product_id`, thus that index is unused. Since Rails generated the model and migration for us, it snuck in really quietly.

An unused index is a waste of database resources. It takes up storage space, and it slows down `UPDATE`s and `INSERT`s, in this case on the `shopping_cart_products` table.

Getting rid of this unused index is easy:

    class RemoveIndexShoppingCartProductsOnProductId < ActiveRecord::Migration
      def up
        remove_index(:shopping_cart_products, :product_id)
      end

      def down
        add_index(:shopping_cart_products, :product_id)
      end
    end

Always be conscious about adding database indexes. Only add one if you're really sure you need it.

As application requirements may change over time, so may the need for indexes. Use database tools to regularly monitor for potentially unused indexes. Be sure to monitor it on the production environment to get the best results.
