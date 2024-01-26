// Simple class helper utilities
// Copyright (c) 2024 Joseph Huckaby
// Released under the MIT License

class HookHelper {
	
	registerHook(name, handler) {
		// register a hook, called by plugins
		// hooks are different than event listeners, as they are called in async sequence
		if (!this.hooks) this.hooks = {};
		if (!this.hooks[name]) this.hooks[name] = [];
		this.hooks[name].push( handler );
	}
	
	removeHook(name, handler) {
		// remove single hook listener or all of them
		if (!this.hooks) this.hooks = {};
		if (handler) {
			if (this.hooks[name]) {
				let idx = this.hooks[name].indexOf(handler);
				if (idx > -1) this.hooks[name].splice( idx, 1 );
				if (!this.hooks[name].length) delete this.hooks[name];
			}
		}
		else delete this.hooks[name];
	}
	
	fireHook(name, thingy, callback) {
		// fire all listeners for a given hook
		// calls both sync and async listeners
		let self = this;
		if (!this.hooks) this.hooks = {};
		
		// now do the normal async dance
		if (!this.hooks[name] || !this.hooks[name].length) {
			process.nextTick( callback );
			return;
		}
		
		// fire hooks in async series
		let idx = 0;
		let iterator = function() {
			let handler = self.hooks[name][idx++];
			if (!handler) return callback();
			
			if (handler.constructor.name === "AsyncFunction") {
				// async style
				handler.call( self, thingy ).then( iterator, callback );
			}
			else {
				// callback-style
				let nextThread = 0;
				handler.call( self, thingy, function(err) {
					if (err) return callback(err);
					
					// ensure async, to prevent call stack overflow
					if (nextThread) iterator();
					else process.nextTick( iterator );
				} );
				nextThread++;
			}
		};
		iterator();
	}
	
} // HookHelper

const asyncifyMethod = function(origFunc, argNames) {
	// asyncify a single class method
	// resolution will be array of callback arguments (err, results, etc.)
	// also supports classic callback calling convention
	return async function(...args) {
		let self = this;
		
		// sniff for classic callback style
		if (typeof(args[ args.length - 1 ]) == 'function') return origFunc.call(self, ...args);
		
		// promise/async style
		return new Promise( (resolve, reject) => {
			origFunc.call(self, ...args, function(...results) {
				let err = results.shift();
				if (err) reject(err);
				else if (argNames) {
					let resultsObj = {};
					argNames.forEach( function(name, idx) {
						resultsObj[name] = results[idx];
					} );
					resolve( resultsObj );
				}
				else resolve( (results.length > 1) ? results : results[0] );
			});
		});
	};
}; // asyncifyMethod

/** 
 * Helper functions for classes.
 * @module ClassUtil
 */
const ClassUtil = module.exports = {
	
	/** 
	 * Convert one or more callback-style functions to async.
	 * @param {Function} obj - The class to convert functions in.
	 * @param {(Object|RegExp)} methods - The set of modules to convert.
	 */
	asyncify(obj, methods) {
		// asyncify one or more methods in class
		let proto = obj.prototype;
		if (typeof(methods) == 'string') methods = [ methods ];
		
		if (Array.isArray(methods)) {
			// specific set of methods to asyncify
			methods.forEach( function(key) {
				if (proto[key] && !proto[key].__async && (proto[key].constructor.name !== "AsyncFunction")) {
					proto[key] = asyncifyMethod( proto[key] );
					proto[key].__async = true;
				}
			} );
		}
		else if (methods instanceof RegExp) {
			// regular expression to match against method names
			Object.getOwnPropertyNames(proto).forEach( function(key) { 
				if (!key.match(/^(__name|constructor|prototype)$/) && (typeof(proto[key]) == 'function') && key.match(methods) && !proto[key].__async && (proto[key].constructor.name !== "AsyncFunction")) { 
					proto[key] = asyncifyMethod( proto[key] ); 
					proto[key].__async = true;
				} 
			}); 
		}
		else {
			// hash to define callback arg names for each async func
			for (let key in methods) {
				if (proto[key] && !proto[key].__async && (proto[key].constructor.name !== "AsyncFunction")) {
					proto[key] = asyncifyMethod( proto[key], methods[key] );
					proto[key].__async = true;
				}
			}
		}
	},
	
	/** 
	 * Mixin one or more classes into a target class.
	 * @param {Function} obj - The target class to mix mixins into.
	 * @param {Object} mixers - The array of classes to mixin.
	 * @param {boolean} [force=false] - Overwrite existing methods and static properties.
	 */
	mixin(obj, mixers, force) {
		// mix-in an external class
		let proto = obj.prototype;
		if (!Array.isArray(mixers)) mixers = [ mixers ];
		
		for (let idx = 0, len = mixers.length; idx < len; idx++) {
			let class_obj = mixers[idx];
			let class_proto = class_obj.prototype;
			if (!class_proto) throw new Error("All mixins must be classes.");
			let class_inst = new class_obj();
			
			// prototype methods
			Object.getOwnPropertyNames(class_proto).forEach( function(key) {
				if (!key.match(/^(__name|constructor|prototype)$/) && (!(key in proto) || force)) {
					proto[key] = class_proto[key];
				}
			});
			
			// public class fields
			Object.getOwnPropertyNames(class_inst).forEach( function(key) {
				if (!key.match(/^(__name|constructor|prototype)$/) && (!(key in proto) || force)) {
					proto[key] = class_inst[key];
				}
			});
			
			// static members
			Object.getOwnPropertyNames(class_obj).forEach( function(key) {
				if (!key.match(/^(name|length|prototype)$/) && (!(key in obj) || force)) {
					obj[key] = class_obj[key];
				}
			});
		} // foreach mixin
	},
	
	/** 
	 * Add event listener and emitter support to a class.
	 * @param {Function} obj - The target class to add event support into.
	 */
	eventify(obj) {
		ClassUtil.mixin(obj, require("events").EventEmitter);
	},
	
	/** 
	 * Add hook support to a class.
	 * @param {Function} obj - The target class to add hook support into.
	 */
	hookify(obj) {
		ClassUtil.mixin(obj, HookHelper);
	}
	
}; // ClassUtil

// asyncify fireHook
ClassUtil.asyncify( HookHelper, ['fireHook'] );
