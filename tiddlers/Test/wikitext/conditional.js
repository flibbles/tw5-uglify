/*\
title: Test/wikitext/conditional.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with conditionals like <%if%>.

\*/

describe('wikitext uglifier', function() {

$tw.utils.test.wikitext.ifAtLeastVersion("5.3.2").
describe('conditional', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('inline', function() {
	test("<% if dog %>Content<% endif %>", "<%if dog%>Content");
	test("<% if dog %>Content<% endif %>Tail", "<%if dog%>Content<%endif%>Tail");
	test("<% if dog %>Content<% else %>2nd<% endif %>", "<%if dog%>Content<%else%>2nd");
	test("<% if dog %>Content<% elseif cat %>2nd<% else %>3rd <% endif %>", "<%if dog%>Content<%elseif cat%>2nd<%else%>3rd ");
	test("<% if [tag[x]] %>Content<% elseif cat %>2nd<% else %>3rd <% endif %>", "<%if [tag[x]]%>Content<%elseif cat%>2nd<%else%>3rd ");
	test("<% if [tag[x]] %>Content<% elseif [tag[y]] %>2nd<% else %>3rd <% endif %>", "<%if [tag[x]]%>Content<%elseif [tag[y]]%>2nd<%else%>3rd ");
	// newlines vs EOS
	test(  "<% if x %>\n\n<$reveal/>\n<%endif %>", "<%if x%>\n\n<$reveal/>\n<%endif%>");
	test(t+"<% if x %>\n\n<$reveal/>\n<%endif %>", "<%if x%>\n\n<$reveal/>");
});

it('block', function() {
	test("<% if dog %>\n\n\n\nContent<% endif %>", "<%if dog%>\n\nContent");
	test("<% if dog %>\r\n\r\nContent<% endif %>", "<%if dog%>\n\nContent");
	test("<% if dog %>  \n\n  Content<% endif %>", "<%if dog%>\n\nContent");
	test("<% if dog %>\n\n\n\nContent<% endif %>\n\nTail", "<%if dog%>\n\nContent<%endif%>Tail");
	test("<% if dog %>\n\nContent<% else %>2nd<% endif %>", "<%if dog%>\n\nContent<%else%>2nd");
	test("<% if dog %>\n\nContent<% else %>  \n\n  2nd<% endif %>", "<%if dog%>\n\nContent<%else%>\n\n2nd");
	test("<% if [tag[x]] %>\n\n---\n<% else %>---<% endif %>", "<%if [tag[x]]%>\n\n---\n<%else%>---");
	test("<% if [tag[x]] %>\n\n---\n<% elseif dog %>---<% else %>---<% endif %>", "<%if [tag[x]]%>\n\n---\n<%elseif dog%>---<%else%>---");
});

it('non-tail material at end', function() {
	test(  "<% if dog %>\n\n---\n<% endif %>", "<%if dog%>\n\n---");
	test(  "<% if dog %>\n\n---<% endif %>", "<%if dog%>\n\n---<%endif%>");
	test(  "<% if dog %>\n\n--- <% endif %>", "<%if dog%>\n\n--- ");
	test(t+"<% if dog %>\n\n--- <% endif %>", "<%if dog%>\n\n---<!---->");
});

it('empty filter', function() {
	test("<% if '' %>Content<% else %>Other<% endif %>", "<%if %>Content<%else%>Other");
	test("<% if    %>Content<% endif %>", "<%if %>Content");
	test("<% if '' %>Content<% endif %>", "<%if %>Content");
	test('<% if "" %>Content<% endif %>', "<%if %>Content");
});

it('broken', function() {
	// This one fails to parse at all. Not a legal conditional
	test("<% if%>Content<% endif %>", "<% if%>Content<% endif %>");
	test("<% if [tag[g]]%>Content<% elseif%>Other<% endif %>", "<%if [tag[g]]%>Content<% elseif%>Other");
});

it('missing endif', function() {
	test("<% if d %>\n\nContent", "<%if d%>\n\nContent");
	test("<% if d %>\n\n1<% else %>\n\n2", "<%if d%>\n\n1<%else%>\n\n2");
	test("<% if [tag[d]] %>\n\n1<% elseif c %>\n\n2", "<%if [tag[d]]%>\n\n1<%elseif c%>\n\n2");
});

});});
