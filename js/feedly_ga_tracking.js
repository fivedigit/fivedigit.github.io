$(document).ready(function() {
  $("a").on('click', function() {
		var href = $(location).attr('href');
		var page = $(document).attr('title');

		ga('send', {
			'hitType': 'social',
			'socialNetwork': 'feedly',
			'socialAction': 'subscription_visit',
			'socialTarget': href,
			'page': page
		});
  });
});
