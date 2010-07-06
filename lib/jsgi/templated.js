/**
 * Wraps text/html output by a specified HAML template
 *
 * requires "haml": "jar:http://github.com/visionmedia/haml.js/zipball/master!/lib/" in package.json
 */
//function dir(){var sys=require('sys');for(var i=0,l=arguments.length;i<l;i++)sys.debug(sys.inspect(arguments[i]));}

exports.Templated = function(options, nextApp){
	if (!options) options = {};
	var haml = require('haml/haml');
	var media = require('pintura/media');
	// re-register text/html media handler
	media.Media({
		mediaType: 'text/html',
		getQuality: function(object){
			return options.force ? 1.0 : 0.1;
		},
		serialize: function(object, request, response){
			var template = request.scriptName.replace(/\//g, '');
			var arr = object.toRealArray ? object.toRealArray() : object;
			//return [object.toRealArray()];
			//return [request.scriptName, template];
			return {
				forEach: function(write){
					write(haml.partial(template, {items: arr, options: options}));
				}
			};
		}
	});
	// serialize untemplated object
	function beautify(object){
		return JSON.stringify(object);
	}
	// extend HAML to support partials
	haml.partial = function(template, locals){
		// cache template
		var filename = template;
		try {
			if (!options.cache || !haml.cache[filename])
				var template = require('fs-promise').readFileSync(options.root + '/' + filename + '.haml');
		} catch (x) {
			return beautify(locals);
			//return 'No such template: ' + filename;
			//throw new URIError('No such template: ' + filename);
		}
		// merge locals and template
		return haml.render(template, {
			context: haml, // N.B. this will be 'this' in templates
			locals: locals, // variables available to the templates
			cache: options.cache,
			filename: filename
		});
	}
	//
	return function(request){
		if (options.force)
			request.headers.accept = 'text/html';
		return require('commonjs-utils/promise').when(nextApp(request), function(response){
			var html = response.headers['content-type']; html = html && html.indexOf('text/html') >= 0;
			// AJAX call or not text/html -> return pure content
			// TODO: configurable options.skip() to skip wrapping?
			if (!(options.force || html && !request.xhr))
				return response;
			// vanilla HTML -> wrap it in template
			var template = request.template || response.template || options.template || 'index';
			var locals = ((typeof options.vars === 'function') ? options.vars(request) : options.vars) || {};
			// support flash messages
			locals.flash = response.flash;
			// cache response body
			locals.content = media.forEachableToString(response.body);
			// replace response.body with template with content partial set to cached body
			var newBody = haml.partial(template, locals);
			response.body = {
				forEach: function(write){
					write(newBody);
				}
			};
			return response;
		});
	};
};