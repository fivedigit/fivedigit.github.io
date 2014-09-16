---
layout: post
title:  "Conditionally map a single route to different controllers"
date:   2013-02-19 19:14:47
author: "Jeroen Weeink"
tags:   routing constraints
---
Sometimes it's useful to have the same route conditionally map to different controllers. To illustrate this, imagine we have a blog with categories and posts, each of which have a similar URL, `/some-category` for categories and `/some-post` for posts. Our `routes.rb` file looks something like this:

    get ':slug', to: 'categories#show'
    get ':slug', to: 'posts#show'

So how do we know to which controller a request has to go? The routes would be identical, but only one can match, and doing a redirect from one controller to the other seems very dirty and not the Rails way.

Fortunately, Rails offers a mechanism to solve this problem, we can use constraint classes for these routes, which can determine if a request matches a route. Such a constraint class looks like this:

    class CategoryConstraint
      def matches?
        Category.where(slug: request.path_parameters[:slug]).exists?
      end
    end

If `matches?` returns `true`, then the request matches the route it's attached to. Otherwise, the next route is being matched against. This constraint class checks if there's a `Category` for a slug.

Now place this class in `lib/category_constraint.rb`. Don't forget to restart the server to make sure the class is loaded. Next, we have to add the constraint in our routes:

    get ':slug', to: 'categories#show', constraints: CategoryConstraint.new
    get ':slug', to: 'posts#show'

Now the category route only matches if a `Category` with the requested slug actually exists, otherwise it matches against the posts route.

You could add another constraint to the posts route, and let it match against another route if neither a category nor post exists. Or you could have it eventually display a 404 page or do a redirect.
