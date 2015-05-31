---
layout: post
title:  "Don't use before_action to load data"
date:   2015-05-31 10:45:57 UTC
author: "Jeroen Weeink"
description: "before_action filters are often used to load data, but results in complicated and hard to maintain controllers. Luckily, there's an easy fix."
---
Controller filters are a common sight in Ruby on Rails controllers. The `before_filter` specifically can be used to halt the request cycle. This is useful to prevent unauthorized access to controller actions, but it's also very often used to load database records.

Take a look at this controller:

    class TreesController
      before_action :authenticate_user!
      before_action :find_forest
      before_action :find_trees
      before_action :find_tree, except: [:index, :new, :create]

      def index
      end

      def show
      end

      def edit
      end

      def update
        if @tree.update(tree_params)
          redirect_to(@tree)
        else
          render('edit')
        end
      end

      private

      def find_forest
        @forest = Forest.find(params[:forest_id])
      end

      def find_trees
        @trees = @forest.trees
      end

      def find_tree
        @tree = @trees.find(params[:id])
      end
    end

The `before_action` filters have been used to make the controller DRY. The forest and trees are loaded by the filters and assigned to instance variables.

The views for `show` and `edit` have access to the `@tree` instance variable, but this isn't obvious. You have to look at the controller and connect the dots to figure out which variables are available where.

Perhaps the controller has become too DRY. The filters are coupled to the controller actions in a very weird way. In fact, the `:find_trees` and `:find_tree` filters are coupled to *each other* as well, because `:find_tree` depends on `:find_trees`. In terms of the problem domain, it becomes hard to see the forest through the trees (pun intended).

In other words, clarity has been sacrificed for the sake of DRY-ness. Don't get me wrong, DRY is a great concept, but not when it turns your Rails controller into a complicated puzzle!

In my opinion, before filters should only ever be used to do what they do best: halting the request cycle. They should not be used for data loading and preparing state.

Applying that to our controller would result in something like this:

    class TreesController
      before_action :authenticate_user!

      def index
        @trees = find_forest.trees
      end

      def show
        @tree = find_tree
      end

      def edit
        @tree = find_tree
      end

      def update
        @tree = find_tree

        if @tree.update(tree_params)
          redirect_to(@tree)
        else
          render('edit')
        end
      end

      private

      def find_tree
        find_forest.trees.find(params[:id])
      end

      def find_forest
        Forest.find(params[:forest_id])
      end
    end

The filters which were previously loading data have been replaced with plain method calls from the controller actions. Now it's immediately obvious which data is loaded where.
