// Unit tests for class-util

const { asyncify, mixin, eventify, hookify } = require('./index.js');

class GenericBaseClass {
	base() { return "BASE"; }
}

exports.tests = [

	function testMixins(test) {
		// mixin base class and another class
		let MyOtherClass = class Other {
			prop1 = "hello";
			static noise = "fzzz";
			bar() { return "baz"; }
		};
		
		let MyClass = class Foo {
			foo() { return "bar"; }
		};
		
		mixin( MyClass, [ GenericBaseClass, MyOtherClass ] );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo.foo() does not equal bar" );
		test.ok( instance.bar() === "baz", "Foo.bar() does not equal baz" );
		test.ok( instance.base() === "BASE", "Foo.base() does not equal BASE" );
		test.ok( instance.prop1 === "hello", "Property missing from instance" );
		test.ok( MyClass.noise === "fzzz", "Static property missing from instance" );
		test.done();
	},
	
	function testEvents(test) {
		test.expect( 2 );
		
		let MyClass = class Foo {
			foo() { return "bar"; }
		};
		eventify( MyClass );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		instance.on('party', function() {
			test.ok( true, "Went to party" );
		});
		instance.emit( 'party' );
		
		test.done();
	},
	
	function testHooks(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
		};
		hookify( MyClass );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		let went_to_party = false;
		instance.registerHook( 'party', function (thingy, callback) {
			test.ok( true, "Went to party" );
			test.ok( thingy === "present", "Received a present" );
			went_to_party = true;
			setTimeout( function() { callback(); }, 100 ); // delay completion of hook
		});
		
		let went_home = false;
		instance.registerHook( 'party', function(thingy, callback) {
			test.ok( true, "Went home" );
			went_home = true;
			callback(); // same thread
		});
		
		instance.fireHook( 'party', "present", function(err) {
			test.ok( !err, "Unexpected error from party hook: " + err );
			test.ok( went_to_party, "Party hook was not fired" );
			test.ok( went_home, "Second party hook was not fired" );
			test.done();
		} );
	},
	
	function testAsyncify(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			sleep(ms, callback) {
				setTimeout( function() { callback(); }, ms );
			}
		};
		asyncify( MyClass, 'sleep' );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			let before = Date.now();
			await instance.sleep( 100 );
			let elapsed = Date.now() - before;
			// allowing for some error here, as clock corrections do happen
			test.ok( elapsed > 95, "Unexpected elapsed time for await sleep test: " + elapsed );
			test.done();
		})();
	},
	
	function testAsyncifyWithError(test) {
		test.expect(2);
		
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			pour(callback) {
				callback( new Error("frogs") );
			}
		};
		asyncify( MyClass, 'pour' );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			try {
				let result = await instance.pour();
			}
			catch(err) {
				test.ok( err.message === 'frogs', "Unexpected error message: " + err.message );
			}
			test.done();
		})();
	},
	
	function testAsyncifyWithSingleArg(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			pour(callback) {
				callback(null, "8oz");
			}
		};
		asyncify( MyClass, 'pour' );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			let result = await instance.pour();
			test.ok( result === "8oz", "Unexpected result: " + result );
			test.done();
		})();
	},
	
	function testAsyncifyWithMultiArgs(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			pour(callback) {
				callback(null, 8, "oz");
			}
		};
		asyncify( MyClass, 'pour' );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			let [amount, units] = await instance.pour();
			test.ok( amount === 8, "Unexpected amount: " + amount );
			test.ok( units === "oz", "Unexpected units: " + units );
			test.done();
		})();
	},
	
	function testAsyncifyWithNamedArgs(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			pour(callback) {
				callback(null, 8, "oz");
			}
		};
		asyncify( MyClass, { pour: ['amount', 'units'] } );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			let {amount, units} = await instance.pour();
			test.ok( amount === 8, "Unexpected amount: " + amount );
			test.ok( units === "oz", "Unexpected units: " + units );
			test.done();
		})();
	},
	
	function testAsyncifyWithNamedArgsSelective(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			pour(callback) {
				callback(null, 8, "oz");
			}
		};
		asyncify( MyClass, { pour: ['amount', 'units'] } );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		(async function() {
			let {amount} = await instance.pour();
			test.ok( amount === 8, "Unexpected amount: " + amount );
			test.done();
		})();
	},
	
	function testAsyncHooks(test) {
		let MyClass = class Foo {
			foo() { return "bar"; }
			
			sleep(ms, callback) {
				setTimeout( function() { callback(); }, ms );
			}
		};
		asyncify( MyClass, 'sleep' );
		hookify( MyClass );
		
		let instance = new MyClass();
		test.ok( instance.foo() === "bar", "Foo does not equal bar" );
		
		let went_to_party = false;
		instance.registerHook( 'party', async function (thingy) {
			test.ok( true, "Went to party" );
			test.ok( thingy === "present", "Received a present" );
			went_to_party = true;
			await this.sleep(100);
		});
		
		(async function() {
			let before = Date.now();
			await instance.fireHook( 'party', "present" );
			let elapsed = Date.now() - before;
			// allowing for some error here, as clock corrections do happen
			test.ok( elapsed > 95, "Unexpected elapsed time for async hook test: " + elapsed );
			test.done();
		})();
	}
	
];
