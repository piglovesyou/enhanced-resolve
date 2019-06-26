/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
"use strict";

function startsWith(string, searchString) {
	const stringLength = string.length;
	const searchLength = searchString.length;

	// early out if the search length is greater than the search string
	if (searchLength > stringLength) {
		return false;
	}
	let index = -1;
	while (++index < searchLength) {
		if (string.charCodeAt(index) !== searchString.charCodeAt(index)) {
			return false;
		}
	}
	return true;
}

module.exports = class AliasPlugin {
	constructor(source, options, target) {
		this.source = source;
		this.options = Array.isArray(options) ? options : [options];
		this.target = target;
	}

	apply(resolver) {
		const target = resolver.ensureHook(this.target);
		resolver
			.getHook(this.source)
			.tapAsync("AliasPlugin", (request, resolveContext, callback) => {
				const innerRequest = request.request || request.path;
				if (!innerRequest) return callback();

				optionsRecur(this.options);

				function optionsRecur(options) {
					const [item, ...restOptions] = options;
					// Any of options were not matched
					if (!item) return callback();

					const isEligibleRequest =
						innerRequest === item.name ||
						(!item.onlyModule && startsWith(innerRequest, item.name + "/"));

					if (!isEligibleRequest) return optionsRecur(restOptions);

					aliasesRecur(item.alias);

					function aliasesRecur(aliases) {
						const [alias, ...restAliases] = aliases;

						// Try next option
						if (!alias) return optionsRecur(restOptions);

						const needsAliasing =
							innerRequest !== alias && !startsWith(innerRequest, alias + "/");

						if (!needsAliasing) return aliasesRecur(restAliases);

						const newRequestStr = alias + innerRequest.substr(item.name.length);
						const obj = Object.assign({}, request, { request: newRequestStr });
						return resolver.doResolve(
							target,
							obj,
							"aliased with mapping '" +
								item.name +
								"': '" +
								alias +
								"' to '" +
								newRequestStr +
								"'",
							resolveContext,
							(err, result) => {
								if (err) return callback(err);

								// Try next alias
								if (result === undefined) return aliasesRecur(restAliases);

								// Found one!
								callback(null, result);
							}
						);
					}
				}
			});
	}
};
