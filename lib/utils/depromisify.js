function declareArguments(count) {
	return new Array(count).join('arg,') + 'arg';
}

function giveArity(closure, arity) {
	return new Function(
		declareArguments(arity),	// arguments list
		'return this.apply(null, arguments);'	// actual call
	).bind(closure);
}

module.exports = function(fn) {
  const res = function() {
    const callback = arguments[arguments.length - 1];
    fn.apply(null, arguments).then((data) => callback(null, data)).catch(callback);
  }
  return giveArity(res, fn.length + 1);
}
