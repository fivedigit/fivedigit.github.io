---
layout: post
title:  "Rails Anti-Pattern: Fat Decorator"
date:   2015-12-09 07:20:57 UTC
author: "Jeroen Weeink"
description: "Learn how unnecessary indexes easily sneak into your Rails application, and what you can do about it."
description: "In Ruby on Rails, decorators have many benefits. But they too can grow complex. This post explains how to keep decorators small and simple."
---
Using decorators in Ruby on Rails has many benefits. Models become less fat, views less complicated, and using the procedural view helpers becomes a thing of the past.

When applying decorators to your Rails project, you might be tempted to maintain a 1:1 mapping between models and decorators. All the presentation logic of a `Article` would go into an `ArticleDecorator`. While the decorators are small, this may be a valid approach.

But over time, the decorators will grow as requirements are added. They'll collect more and more methods, get more responsibilities and slowly the decorators grow fat. Bugs will soon creep out from under the big pile of methods.

Stuffing everything inside a single decorator isn't really a big step up from using Rails' view helpers. If you want to get the most out of decorators, it's important to apply the principles of object oriented programming to them as well.

Here are a couple of code smells I commonly find in decorators.

## Divergent Change
Large decorators often span multiple pieces of functionality. As requirements change, one decorator finds itself changed multiple times for different requirements. This smell is called Divergent Change.

It's an indicator that the Single Responsibility Principle is being violated. And no, "taking care of presentation logic" doesn't count as a single responsibility here ;-) Groups of closely related methods responsible for a single part of functionality should probably be moved out into their own classes.

## Feature Envy
When moving unnecessary logic out of a view, it's often placed into the nearest possible decorator. When doing this, a decorator will start to reach deep into other objects and eventually will be more concerned with other objects rather than itself.

This this introduces a lot of coupling between objects and makes it hard to refactor. This kind of functionality needs to be moved to a more appropriate decorator.

## A smelly decorator
Here's a decorator to handle the presentation logic of a Git commit. I've omitted quite some parts for brevity of the example. I'm using the Draper gem, though you could go with any other solution, or even your own.

    class CommitDecorator < Draper::Decorator
      delegate_all

      def author_link
        h.link_to(author.name, h.profile_path(author.username))
      end

      def parent_link
        h.link_to(parent.truncated_sha, h.project_commit_path(project, parent.sha))
      end

      def diff_stats
        h.t('commits.show.diff_stats_html',
            changed: diffs.count,
            additions: diffs.sum(&:additions),
            deletions: diffs.sum(&:deletions))
      end

      def file_changes
        diffs.map do |diff|
          DiffLine.new(
            status_class_for(diff), diff.path, diff.additions, diff.deletions)
        end
      end

      private

      DiffLine = Struct.new(:status_class, :path, :additions, :deletions)

      def status_class_for(diff)
        if diff.deleted?
          'deletion'
        elsif diff.added?
          'addition'
        else
          'change'
        end
      end
    end

A commits controller may look like this:

    class CommitsController < ApplicationController
      decorates_assigned :commits, :commit

      def index
        @commits = find_project.commits
      end

      def show
        @commit = find_project.find_commit_by_sha(params[:sha])
      end

      private

      def find_project
        Project.find(params[:project_id])
      end
    end

There are two scenarios here:

* A list of commits in the project is displayed
* One commit is displayed along with its changed files

## Problems
The decorator incorporates both of the smells described above.

It seems awkward to have a decorator with all these functionalities if all you want to do is to display a summarized commit with only a bit of information.

It's reaching into the tiny little details of the other objects quite a lot. It's very coupled to the internals of diffs especially.

## Making it less envy
The most alarming issue is the reaching into diffs to gather the file changes. Let's quickly refactor that into a `DiffDecorator`:

    class DiffDecorator < Draper::Decorator
      delegate_all

      def status_class
        if deleted?
          'deletion'
        elsif added?
          'addition'
        else
          'change'
        end
      end
    end

Note how much that already cleans up the `CommitDecorator`. The `file_changes` is now synonymous to the decorated `diffs`. I've added an `alias_method` to keep the same interface, though this is not strictly necessary.

    class CommitDecorator < Draper::Decorator
      delegate_all
      decorates_association :diffs

      alias_method :file_changes, :diffs

      def author_link
        h.link_to(author.name, h.profile_path(author.username))
      end

      def parent_link
        h.link_to(parent.truncated_sha, h.project_commit_path(project, parent.sha))
      end

      def diff_stats
        h.t('commits.show.diff_stats_html',
            changed: diffs.count,
            additions: diffs.sum(&:additions),
            deletions: diffs.sum(&:deletions))
      end
    end

The links to the author and parent commit are better off in their own decorator too. Since parent is also a commit object itself, this implies adding a `link` method to `CommitDecorator`.

    class AuthorDecorator < Draper::Decorator
      delegate_all

      def link
        h.link_to(name, h.profile_path(username))
      end
    end

    class CommitDecorator < Draper::Decorator
      delegate_all
      decorates_association :diffs
      decorates_association :author
      decorates_association :parent

      alias_method :file_changes, :diffs

      delegate :link, to: :author, prefix: true
      delegate :link, to: :parent, prefix: true

      def link
        h.link_to(truncated_sha, h.project_commit_path(project, sha))
      end

      def diff_stats
        h.t('commits.show.diff_stats_html',
            changed: diffs.count,
            additions: diffs.sum(&:additions),
            deletions: diffs.sum(&:deletions))
      end
    end

Now the `CommitDecorator` only has some delegations for the `author_link` and `parent_link`.

## Dealing with Divergent Change
I always like to have some kind of default or base decorator for a model which defines the methods commonly used in different contexts. It makes sense for this to be called `CommitDecorator`. Whenever `commit.decorate` is called, it's automatically decorated with the default decorator.

Some decorated functionality may only be required in a single context. I prefer to put these into their own decorator classes, so it becomes more obvious where it's being used, and it's not hiding in between the common functionality.

For this example, I'd consider a summarized commit sufficient to be decorated by a default decorator. But the detailed commit definitely needs its own:

    module Commits
      class DetailedCommitDecorator < Draper::Decorator
        delegate_all

        def initialize(*args)
          super(CommitDecorator.new(*args))
        end

        def diff_stats
          h.t('commits.show.diff_stats_html',
              changed: diffs.count,
              additions: diffs.sum(&:additions),
              deletions: diffs.sum(&:deletions))
        end
      end
    end

I always namespace these context-specific decorators by the class they're decorating. When you've got many decorators, this allows you to still have an overview.

I dislike using inheritance with decorators, it feels to be against the nature of a decorator. It's also confusing when overriding methods from the parent class. Overriding inherited methods may need another approach than overriding methods already defined on the model.

Therefore, I first wrap the original commit object into a `CommitDecorator`. This would be equivalent to doing something like `Commits::DetailedCommitDecorator.new(CommitDecorator.new(commit))`, but I don't want to have to think about applying both decorators all the time. Note I'm using `delegate_all` in all of my decorators to make sure any method unknown to the decorator is being delegated to the decorated object.

Extracting the functionality of a detailed commit leaves the `CommitDecorator` greatly simplified:

    class CommitDecorator < Draper::Decorator
      delegate_all
      decorates_association :diffs
      decorates_association :author
      decorates_association :parent

      alias_method :file_changes, :diffs

      delegate :link, to: :author, prefix: true
      delegate :link, to: :parent, prefix: true

      def link
        h.link_to(truncated_sha, h.project_commit_path(project, sha))
      end
    end

The last thing to do is to make sure the controller applies the appropriate decorators:

    class CommitsController < ApplicationController
      decorates_assigned :commits
      decorates_assigned :commit, with: Commits::DetailedCommitDecorator

      def index
        @commits = find_project.commits
      end

      def show
        @commit = find_project.find_commit_by_sha(params[:sha])
      end

      private

      def find_project
        Project.find(params[:project_id])
      end
    end

## Conclusion
Avoid turning your decorators into your view helper surrogates. Avoid creating a tangled mess of methods and responsibilities by appropriately dealing with code smells in your decorators. Don't be afraid to introduce new decorator classes, but only do so if you can justify their existence.

What kind of code smells do you frequently encounter in your decorators? Let me know in the comments below!
