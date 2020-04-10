/**
 * Module dependencies.
 */

var ejs = require('..')
  , fs = require('fs')
  , readFile = fs.promises.readFile
  , assert = require('should');

/**
 * Apparently someone wrote a test depending on a method
 * not included in the specified version of Should
 */
assert.Assertion.add('include', function (param) {
  if (this.obj.indexOf(param) > -1) {
  }
  else {
    throw new Error('Substring "' + param +
        '" not found in string "' + this.obj + '"');
  }
});

/**
 * Load fixture `name`.
 */

async function fixture(name) {
  return (await readFile('test/fixtures/' + name, 'utf8')).replace(/\r/g, '');
}

/**
 * User fixtures.
 */

var users = [];
users.push({ name: 'tobi' });
users.push({ name: 'loki' });
users.push({ name: 'jane' });

describe('ejs.compile(str, options)', function(){
  it('should compile to a function', async function(){
    var fn = await ejs.compile('<p>yay</p>');
    (await fn()).should.equal('<p>yay</p>');
  })

  it('should throw if there are syntax errors', async function(){
    try {
      await ejs.compile(await fixture('fail.ejs'));
    } catch (err) {
      err.message.should.include('compiling ejs');

      try {
        await ejs.compile(await fixture('fail.ejs'), { filename: 'fail.ejs' });
      } catch (err) {
        err.message.should.include('fail.ejs');
        return;
      }
    }

    assert(false, 'compiling a file with invalid syntax should throw an exception');
  })

  it('should allow customizing delimiters', async function(){
    var fn = await ejs.compile('<p>{= name }</p>', { open: '{', close: '}' });
    (await fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

    var fn = await ejs.compile('<p>::= name ::</p>', { open: '::', close: '::' });
    (await fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

    var fn = await ejs.compile('<p>(= name )</p>', { open: '(', close: ')' });
    (await fn({ name: 'tobi' })).should.equal('<p>tobi</p>');
  })

  it('should default to using ejs.open and ejs.close', async function(){
    ejs.open = '{';
    ejs.close = '}';
    var fn = await ejs.compile('<p>{= name }</p>');
    (await fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

    var fn = await ejs.compile('<p>|= name |</p>', { open: '|', close: '|' });
    (await fn({ name: 'tobi' })).should.equal('<p>tobi</p>');
    delete ejs.open;
    delete ejs.close;
  })

  it('should have a working client option', async function(){
    var fn = await ejs.compile('<p><%= foo %></p>', { client: true });
    var str = fn.toString();
    eval('var preFn = ' + str);
    (await preFn({ foo: 'bar' })).should.equal('<p>bar</p>');
  })
})

describe('ejs.render(str, options)', function(){
  it('should render the template', async function(){
    (await ejs.render('<p>yay</p>'))
      .should.equal('<p>yay</p>');
  })

  it('should accept locals', async function(){
    (await ejs.render('<p><%= name %></p>', { name: 'tobi' }))
      .should.equal('<p>tobi</p>');
  })
})

describe('ejs.renderFile(path, options, fn)', function(){
  it('should render a file', async function(){
    (await ejs.renderFile('test/fixtures/para.ejs'))
      .should.equal('<p>hey</p>');
  })

  it('should accept locals', async function(){
    var options = { name: 'tj', open: '{', close: '}' };
    const html = await ejs.renderFile('test/fixtures/user.ejs', options);
    html.should.equal('<h1>tj</h1>');
  })
})

describe('<%=', function(){

  it('should escape &amp;<script>', async function(){
    (await ejs.render('<%= name %>', { name: '&nbsp;<script>' }))
      .should.equal('&amp;nbsp;&lt;script&gt;');
  })

  it("should escape '", async function(){
    (await ejs.render('<%= name %>', { name: "The Jones's" }))
      .should.equal('The Jones&#39;s');
  })

  it("should escape &foo_bar;", async function(){
    (await ejs.render('<%= name %>', { name: "&foo_bar;" }))
      .should.equal('&amp;foo_bar;');
  })

  it("should handle await", async function(){
    (await ejs.render(await fixture('await.ejs')))
      .should.equal(await fixture('await.html'))
  })
})

describe('<%-', function(){
  it('should not escape', async function(){
    (await ejs.render('<%- name %>', { name: '<script>' }))
      .should.equal('<script>');
  })

  it('should terminate gracefully if no close tag is found', async function(){
    try {
      await ejs.compile('<h1>oops</h1><%- name ->')
      throw new Error('Expected parse failure');
    } catch (err) {
      err.message.should.equal('Could not find matching close tag "%>".');
    }
  })
})

describe('%>', function(){
  it('should produce newlines', async function(){
    (await ejs.render(await fixture('newlines.ejs'), { users: users }))
      .should.equal(await fixture('newlines.html'));
  })
})

describe('-%>', function(){
  it('should not produce newlines', async function(){
    (await ejs.render(await fixture('no.newlines.ejs'), { users: users }))
      .should.equal(await fixture('no.newlines.html'));
  })
})

describe('<%%', function(){
  it('should produce literals', async function(){
    (await ejs.render('<%%- "foo" %>'))
      .should.equal('<%- "foo" %>');
  })
})

describe('single quotes', function(){
  it('should not mess up the constructed function', async function(){
    (await ejs.render(await fixture('single-quote.ejs')))
      .should.equal(await fixture('single-quote.html'));
  })
})

describe('double quotes', function(){
  it('should not mess up the constructed function', async function(){
    (await ejs.render(await fixture('double-quote.ejs')))
      .should.equal(await fixture('double-quote.html'));
  })
})

describe('backslashes', function(){
  it('should escape', async function(){
    (await ejs.render(await fixture('backslash.ejs')))
      .should.equal(await fixture('backslash.html'));
  })
})

describe('messed up whitespace', function(){
  it('should work', async function(){
    (await ejs.render(await fixture('messed.ejs'), { users: users }))
      .should.equal(await fixture('messed.html'));
  })
})

describe('filters', function(){
  it('should work', async function(){
    var items = ['foo', 'bar', 'baz'];
    (await ejs.render('<%=: items | reverse | first | reverse | capitalize %>', { items: items }))
      .should.equal('Zab');
  })

  it('should accept arguments', async function(){
    (await ejs.render('<%=: users | map:"name" | join:", " %>', { users: users }))
      .should.equal('tobi, loki, jane');
  })

  it('should truncate string', async function(){
    (await ejs.render('<%=: word | truncate: 3 %>', { word: 'World' }))
      .should.equal('Wor');
  })

  it('should append string if string is longer', async function(){
    (await ejs.render('<%=: word | truncate: 2,"..." %>', { word: 'Testing' }))
      .should.equal('Te...');
  })

  it('should not append string if string is shorter', async function(){
    (await ejs.render('<%=: word | truncate: 10,"..." %>', { word: 'Testing' }))
      .should.equal('Testing');
  })

  it('should accept arguments containing :', async function(){
    (await ejs.render('<%=: users | map:"name" | join:"::" %>', { users: users }))
      .should.equal('tobi::loki::jane');
  })
})

describe('exceptions', function(){
  it('should produce useful stack traces', async function(){
    try {
      await ejs.render(await fixture('error.ejs'), { filename: 'error.ejs' });
    } catch (err) {
      err.path.should.equal('error.ejs');
      err.stack.split('\n').slice(0, 8).join('\n').should.equal(await fixture('error.out'));
    }
  })

  it('should not include __stack if compileDebug is false', async function() {
    try {
      await ejs.render(await fixture('error.ejs'), {
        filename: 'error.ejs',
        compileDebug: false
      });
    } catch (err) {
      err.should.not.have.property('path');
      err.stack.split('\n').slice(0, 8).join('\n').should.not.equal(await fixture('error.out'));
    }
  });
})

describe('includes', function(){
  it('should include ejs', async function(){
    var file = 'test/fixtures/include.ejs';
    (await ejs.render(await fixture('include.ejs'), { filename: file, pets: users, open: '[[', close: ']]' }))
      .should.equal(await fixture('include.html'));
  })

  it('should work when nested', async function(){
    var file = 'test/fixtures/menu.ejs';
    (await ejs.render(await fixture('menu.ejs'), { filename: file, pets: users }))
      .should.equal(await fixture('menu.html'));
  })

  it('should include arbitrary files as-is', async function(){
    var file = 'test/fixtures/include.css.ejs';
    (await ejs.render(await fixture('include.css.ejs'), { filename: file, pets: users }))
      .should.equal(await fixture('include.css.html'));
  })

  it('should pass compileDebug to include', async function(){
    var file = 'test/fixtures/include.ejs';
    var fn = await ejs.compile(await fixture('include.ejs'), { filename: file, open: '[[', close: ']]', compileDebug: false, client: true })
    var str = fn.toString();
    eval('var preFn = ' + str);
    str.should.not.match(/__stack/);
    (async function() {
      await preFn({ pets: users });
    }).should.not.throw();
  })
})

describe('comments', function() {
  it('should fully render with comments removed', async function() {
    (await ejs.render(await fixture('comments.ejs')))
      .should.equal(await fixture('comments.html'));
  })
})
