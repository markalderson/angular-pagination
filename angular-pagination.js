angular.module('msl.pagination', []);

angular.module('msl.pagination').factory('mslOverflowChecker', [function () {
	return {
		isOverflowing: function (element) {
			return element[0].scrollHeight > element[0].clientHeight;
		}
	};
}]);

angular.module('msl.pagination').factory('mslViewport', [function () {
	return {
		size: function () {
			return {
				width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
				height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
			};
		}
	};
}]);

angular.module('msl.pagination').factory('mslContentSwapper', [function () {
	return {
		hideBefore: function (element, child) {
			var sibling = child.previousSibling;
			while (sibling) {
				this.hide(sibling);
				sibling = sibling.previousSibling;
			}
		},

		hide: function (child) {
			// Hide element nodes
			if (child.nodeType === 1) angular.element(child).css('display', 'none');
		},

		showAfter: function (element, child) {
			var sibling = child.nextSibling;
			while (sibling) {
				this.show(sibling);
				sibling = sibling.nextSibling;
			}
		},

		show: function(child) {
			// Show element nodes
			if (child.nodeType === 1) angular.element(child).css('display', '');
		},

		showAll: function (element) {
			var children = element[0].children;
			for (var i = 0; i < children.length; i++) this.show(children[i]);
		}
	};
}]);

angular.module('msl.pagination').factory('mslPaginator', ['mslOverflowChecker', 'mslContentSwapper', function (mslOverflowChecker, mslContentSwapper) {
	return {
		paginate: function (element, mslPagination) {
			while (this.morePages(element, mslPagination)) this.newPage(element, mslPagination);
			mslContentSwapper.showAll(element);
		},

		morePages: function (element, mslPagination) {
			var last_page = mslPagination.last_page;
			if (!last_page) return true;
			return last_page.stop !== element[0].lastChild;
		},

		newPage: function (element, mslPagination) {
			var new_page = {};

			// Calculate start (based on previous page)
			var last_page = mslPagination.last_page;
			if (!last_page) new_page.start = element[0].firstChild;
			else new_page.start = last_page.stop.nextSibling;

			// Calculate stop
			// 1. Hide previous content
			// 2. Assume all following content goes into this page
			// 3. Remove stuff from tail until there is no overflow
			mslContentSwapper.hideBefore(element, new_page.start);
			new_page.stop = element[0].lastChild;
			while (mslOverflowChecker.isOverflowing(element)) {
				mslContentSwapper.hide(new_page.stop);
				new_page.stop = new_page.stop.previousSibling;
			}

			// Push new page and make visible again following content
			mslPagination.pages.push(new_page);
			mslPagination.last_page = new_page;
			mslContentSwapper.showAfter(element, new_page.stop);
		}
	};
}]);

angular.module('msl.pagination').factory('mslPageWrapper', ['$compile', function ($compile) {
	return {
		wrapPages: function (root, mslPagination, scope) {
			var pages = mslPagination.pages;
			var wrapper_elements = [];
			for (var i = 0; i < pages.length; i++) {
				wrapper_elements.push(this.wrap(pages[i], mslPagination));
			}
			var configuration = mslPagination.configuration;
			if (configuration && configuration.container && configuration.container.attributes) {
				var container_attributes = configuration.container.attributes;
				for (var i = 0; i < container_attributes.length; i++) {
					var name = container_attributes[i]['name'];
					var value = container_attributes[i]['value'];
					root.attr(name, value);
				}
			}
			for (var i = 0; i < wrapper_elements.length; i++) {
				root[0].appendChild(wrapper_elements[i]);
			}
			root[0].removeAttribute('msl-paginated');
			$compile(root)(scope);
		},

		wrap: function (page, mslPagination) {
			var page_nodes = this.nodesIn(page);
			var wrapper_element_type = 'div';
			var configuration = mslPagination.configuration;
			if (configuration && configuration.pages && configuration.pages.element) {
				wrapper_element_type = configuration.pages.element;
			}
			var wrapper_element = document.createElement(wrapper_element_type);
			if (configuration && configuration.pages && configuration.pages.attributes) {
				var wrapper_element_attributes = configuration.pages.attributes;
				for (var i = 0; i < wrapper_element_attributes.length; i++) {
					var name = wrapper_element_attributes[i]['name'];
					var value = wrapper_element_attributes[i]['value'];
					angular.element(wrapper_element).attr(name, value);
				}
			}
			for (var i = 0; i < page_nodes.length; i++) wrapper_element.appendChild(page_nodes[i]);
			return wrapper_element;
		},

		nodesIn: function(page) {
			var nodes = [];
			var current = page.start;
			while (current != page.stop) {
				nodes.push(current);
				current = current.nextSibling;
			}
			nodes.push(page.stop);
			return nodes;
		}
	};
}]);

angular.module('msl.pagination').factory('mslUnpaginator', [function () {
	return {
		unpaginate: function (element, mslPagination) {
			console.log('unpaginating...')
			var pages = mslPagination.pages;
			for (var i = 0; i < pages.length; i++) this.unpaginatePage(pages[i], element);
		},

		unpaginatePage: function (page, element) {
			var start = page.start;
			var stop = page.stop;
			var container = start.parentElement;
			while (start !== stop) {
				var temp = start.nextSibling;
				element[0].appendChild(start);
				start = temp;
			}
			element[0].appendChild(stop);
			angular.element(container).remove();
		}
	};
}]);

angular.module('msl.pagination').directive('mslPaginated', ['$compile', 'mslViewport', 'mslPaginator', 'mslUnpaginator', 'mslPageWrapper', function ($compile, mslViewport, mslPaginator, mslUnpaginator, mslPageWrapper) {
	return {
		restrict: 'A',
		link: function (scope, element, attributes) {
			var configuration = { fullscreen: false };
			var json_configuration = element.attr('msl-paginated');
			var override = JSON.parse(json_configuration);
			if ('fullscreen' in override) configuration.fullscreen = override.fullscreen;
			configuration.container = override.container;
			configuration.pages = override.pages;

			if (configuration.fullscreen) {
				var size = mslViewport.size();
				angular.element(document.body).css('margin', '0');
				element.css('width', size.width + 'px');
				element.css('height', size.height + 'px');
			}

			var mslPagination = {
				pages: [],
				configuration: configuration
			};
			mslPaginator.paginate(element, mslPagination);
			mslPageWrapper.wrapPages(element, mslPagination, scope);

			function resizeHandler() {
				angular.element(window).unbind('resize', resizeHandler);
				mslUnpaginator.unpaginate(element, mslPagination);
				element.attr('msl-paginated', JSON.stringify(configuration));
				$compile(element)(scope);
			}

			if (configuration.fullscreen) angular.element(window).bind('resize', resizeHandler);
		}
	};
}]);