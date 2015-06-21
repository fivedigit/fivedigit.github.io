// Source: https://gist.github.com/chrisblakley/2fd2181c5735017c69aa
window.twttr = function(d,s,id){
	var js,fjs=d.getElementsByTagName(s)[0];
	if(!d.getElementById(id)){
		js=d.createElement(s);
		js.id=id;js.src="//platform.twitter.com/widgets.js";
		fjs.parentNode.insertBefore(js,fjs);
	}
	return window.twttr || (t = { _e: [], ready: function(f){ t._e.push(f) } });
}(document,"script","twitter-wjs");

twttr.ready(function(twttr){
	twttr.events.bind('tweet', track_tweet);
	twttr.events.bind('follow', track_follow);
});

function track_tweet( event ) {
	if ( event ) {
		var href = jQuery(location).attr('href');
		var pageTitle = jQuery(document).attr('title');
		ga('send', {
			'hitType': 'social',
			'socialNetwork': 'twitter',
			'socialAction': 'tweet',
			'socialTarget': href,
			'page': pageTitle
		});
	}
}

function track_follow( event ) {
	if ( event ) {
		var href = jQuery(location).attr('href');
		var pageTitle = jQuery(document).attr('title');
		ga('send', {
			'hitType': 'social',
			'socialNetwork': 'twitter',
			'socialAction': 'follow',
			'socialTarget': href,
			'page': pageTitle
		});
	}
}
