const sinon = require('sinon');
const expect = require('chai').expect;
const JSDOM = require('jsdom').JSDOM;

const Browser = require('../dist/amara-plugin-engine-browser');

describe('BrowserEngine', function() {

    function bootstrap(target) {
        return {
            type: 'core:bootstrap',
            payload: { target }
        };
    }

    function add(features) {
        return {
            type: 'core:features-added',
            payload: new Set(features)
        };
    }

    function populate(payload) {
        return {
            type: 'core:populate-feature-targets',
            payload
        };
    }

    beforeEach(function createMO() {
        const spec = this;
        spec.window = global.window = new JSDOM('').window;
        window.MutationObserver = function MutationObserver(callback) {
            this.observe = spec.observe = sinon.spy();
            this.disconnect = () => {};
            spec.mutationHandler = callback;
        };
    });

    beforeEach(function createHandler() {
        this.dispatch = sinon.spy();
        this.handler = Browser()(this.dispatch);
        this.el = (type = 'div') =>
            this.window.document.createElement(type);
    });

    describe('on bootstrap', function() {

        it('requests attributes to observe', function() {
            this.handler(bootstrap(this.el()));
            const action = this.dispatch.args[0][0];
            expect(action.type).equals('engine:append-observed-attributes');
        });

        it('observes DOM mutations', function() {
            const root = this.el();
            this.handler(bootstrap(root));
            expect(this.observe.calledWith(root, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class']
            })).true;
        });

        it('finds targets for features', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(add([feature]));
            this.handler(bootstrap(root));
            expect(this.dispatch.calledTwice).true;
            expect(this.dispatch.calledWith({
                type: 'core:enqueue-apply',
                payload: [{feature, targets: [child]}]
            })).true;
        });

        it('does nothing if no targets found', function() {
            const root = this.el();
            const child = this.el();
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(add([feature]));
            this.handler(bootstrap(root));
            expect(this.dispatch.calledTwice).false;
        });

    });

    describe('on features added', function() {

        it('finds targets for features if bootstrapped', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            expect(this.dispatch.calledTwice).true;
            expect(this.dispatch.calledWith({
                type: 'core:enqueue-apply',
                payload: [{feature, targets: [child]}]
            })).true;
        });

        it('does nothing if not bootstrapped', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(add([feature]));
            expect(this.dispatch.calledTwice).false;
        });

        it('updates set of watched attributes', function() {
            const root = this.el();
            const feature = {targets: ['a[route-link]']};
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            expect(this.observe.calledWith(root, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'route-link']
            })).true;
        });

    });

    describe('on populate targets', function() {

        it('adds all targets for feature', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            const map = new Map([[feature, new Set()]]);
            root.appendChild(child);
            this.handler(add([feature]));
            this.handler(bootstrap(root));
            this.handler(populate(map));
            expect(map.size).equals(1);
            expect(map.get(feature).size).equals(1);
            expect(map.get(feature).has(child)).true;
        });

        it('adds related feature/targets of same type', function() {
            const root = this.el();
            const child = this.el('span');
            const feature1 = {targets: ['span']};
            const feature2 = {targets: ['span']};
            const map = new Map([[feature1, new Set()]]);
            root.appendChild(child);
            this.handler(add([feature1, feature2]));
            this.handler(bootstrap(root));
            this.handler(populate(map));
            expect(map.size).equals(2);
            expect(map.get(feature1).size).equals(1);
            expect(map.get(feature2).size).equals(1);
            expect(map.get(feature1).has(child)).true;
            expect(map.get(feature2).has(child)).true;
        });

        it('removes entries with no targets', function() {
            const root = this.el();
            const feature = {targets: ['span']};
            const map = new Map([[feature, new Set()]]);
            this.handler(add([feature]));
            this.handler(bootstrap(root));
            this.handler(populate(map));
            expect(map.size).equals(0);
        });

    });

    describe('on DOM mutation', function() {

        it('dispatches "enqueue-apply" on targets changed', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span.a']};
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            expect(this.dispatch.calledTwice).false;
            child.classList.add('a');
            this.mutationHandler([]);
            expect(this.dispatch.calledWith({
                type: 'core:enqueue-apply',
                payload: [{feature, targets: [child]}]
            })).true;
        });

        it('dispatches "enqueue-apply" on parent changed', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['div.a span']};
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            expect(this.dispatch.calledTwice).false;
            root.classList.add('a');
            this.mutationHandler([]);
            expect(this.dispatch.calledWith({
                type: 'core:enqueue-apply',
                payload: [{feature, targets: [child]}]
            })).true;
        });

        it('dispatches "enqueue-apply" on sibling changed', function() {
            const root = this.el();
            const child = this.el('span');
            const sibling = this.el('link');
            const feature = {targets: ['link.a+span']};
            root.appendChild(sibling);
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            expect(this.dispatch.calledTwice).false;
            sibling.classList.add('a');
            this.mutationHandler([]);
            expect(this.dispatch.calledWith({
                type: 'core:enqueue-apply',
                payload: [{feature, targets: [child]}]
            })).true;
        });

        it('dispatches "targets-removed" for removed feature targets', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            this.mutationHandler([{removedNodes: [child]}]);
            expect(this.dispatch.calledWith({
                type: 'engine:targets-removed',
                payload: [child]
            })).true;
        });

        it('dispatches nothing for removed non-feature targets', function() {
            const root = this.el();
            const child = this.el('span');
            const feature = {targets: ['span']};
            root.appendChild(child);
            this.handler(bootstrap(root));
            this.handler(add([feature]));
            this.mutationHandler([{removedNodes: [root]}]);
            const actions = this.dispatch.args.map(args => args[0].type);
            expect(actions.includes('engine:targets-removed')).false;
        });

    });

});
