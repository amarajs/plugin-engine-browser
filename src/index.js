// @flow

function action(type, payload) {
    return { type, payload };
}

function without(lhs: Set<any>, rhs?: Set<any>) {
    if (!rhs) return lhs;
    const difference = new Set(lhs);
    rhs.forEach(difference.delete, difference);
    return difference;
}

function setHas(node) {
    this.result = this.result && this.set.has(node);
}

function equals(lhs: Set<any>, rhs: Set<any>): boolean {
    let context = {result: true, set: rhs};
    lhs.forEach(setHas, context);
    return context.result && rhs.size === lhs.size;
}

function addOrUpdate(key) {
    const { map, value } = this;
    const set = map.get(key) || new Set();
    set.add(value);
    map.set(key, set);
}

function overwriteWith(targets: Set<any>, feature: Feature) {
    targets.forEach(addOrUpdate, { map: this, value: feature });
}

function overwrite(lhs: Map<Node, Set<Feature>>, rhs: Map<Feature, Set<Node>>) {
    lhs.clear();
    rhs.forEach(overwriteWith, lhs);
}

export default function AmaraPluginEngineBrowser(): AmaraBrowser {

    return function createHandler(dispatch) {

        let root: Element,
            observer: MutationObserver,
            featureTargets: Map<Feature, Set<Node>> = new Map(),
            targetFeatures: Map<Node, Set<Feature>> = new Map();

        const features: Set<Feature> = new Set();
        const attributes: Set<string> = new Set(['class']);
        const rxAttribute = /\[([^=\]]+?)[~^$|*=\]]/;

        function gatherAttributes(feature) {
            let attr,
                attrs,
                attrIndex,
                target,
                targets = feature.targets,
                targetIndex = targets.length;
            while (target = targets[--targetIndex]) {
                attrs = target.match(rxAttribute);
                if (!attrs) continue;
                attrs = attrs.slice(1);
                attrIndex = attrs.length;
                while (attr = attrs[--attrIndex]) {
                    attributes.add(attr);
                }
            }
        }

        function updateWatchedAttributes(subset: Set<Feature>) {
            const before = attributes.size;
            subset.forEach(gatherAttributes);
            const after = attributes.size;
            (after !== before) && observeDOMChanges();
        }

        function removeTargetsFromFeatures(nodes: Set<Node>, feature: Feature) {
            featureTargets.set(feature, without(nodes, this));
        }

        function handleRemovedTargets(removed: Set<Node>) {
            if (!removed.size) return;
            removed.forEach(targetFeatures.delete, targetFeatures);
            featureTargets.forEach(removeTargetsFromFeatures, removed);
            dispatch(action('engine:targets-removed', Array.from(removed)));
        }

        function populateFeatureTargets(feature) {
            const selector = feature.targets.join(', ');
            const targets = new Set(root.querySelectorAll(selector));
            if (root.matches(selector)) targets.add(root);
            featureTargets.set(feature, targets);
        }

        function dispatchEmptyApplyResult(target) {
            const map = {[this.type]: new Map([[target, []]])};
            dispatch(action('core:apply-target-results', map));
        }

        function handleNewlyEmptyFeatures(targets, feature) {
            const currTargets = featureTargets.get(feature);
            const old = without(targets, currTargets);
            old.size && dispatch(action('core:clear-cache', {feature, targets: old}));
            old.forEach(dispatchEmptyApplyResult, feature);
        }

        function populateApplyQueue(targets, feature) {
            const { prevTargets, featuresToApply } = this;
            const previous = prevTargets.get(feature) || new Set();
            if (targets.size && !equals(targets, previous)) {
                featuresToApply.set(feature, targets);
            }
        }

        function updateFeatureTargets(subset: Set<Feature> = features) {
            if (!root) return;
            const prevTargets = new Map(featureTargets);
            const featuresToApply: Map<Feature, Set<Node>> = new Map();
            subset.forEach(populateFeatureTargets);
            prevTargets.forEach(handleNewlyEmptyFeatures);
            featureTargets.forEach(populateApplyQueue, { prevTargets, featuresToApply });
            overwrite(targetFeatures, featureTargets);
            if (featuresToApply.size) {
                onPopulateFeatureTargets(featuresToApply);
                const queue: Array<{feature: Feature, targets: Node[]}> = [];
                featuresToApply.forEach((targets, feature) => queue.push({feature, targets: Array.from(targets)}));
                dispatch(action('core:enqueue-apply', queue));
            }
        }

        function onMutationOccurred(mutationRecords) {
            const removed: Set<Node> = new Set();
            let mutationRecord, index = mutationRecords.length;
            while (mutationRecord = mutationRecords[--index]) {
                Array.from(mutationRecord.removedNodes)
                    .filter(targetFeatures.has, targetFeatures)
                    .forEach(removed.add, removed);
            }
            handleRemovedTargets(removed);
            updateFeatureTargets();
        }

        function observeDOMChanges() {
            if (!root) return;
            observer && observer.disconnect();
            observer = new window.MutationObserver(onMutationOccurred);
            observer.observe(root, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: Array.from(attributes)
            });
        }

        function onBootstrap({target}) {
            root = target;
            dispatch(action('engine:append-observed-attributes', attributes));
            observeDOMChanges();
            updateFeatureTargets();
        }

        function onFeaturesAdded(added: Set<Feature>) {
            added.forEach(features.add, features);
            updateWatchedAttributes(added);
            updateFeatureTargets(added);
        }

        function isSameTypeFeatureWithTargets(feat) {
            const currT = featureTargets.get(feat);
            return feat !== this && feat.type === this.type && currT && currT.size > 0;
        }

        function addFeaturesOfSameType(value: Node) {
            const { feature, map } = this;
            Array.from(targetFeatures.get(value) || new Set())
                .filter(isSameTypeFeatureWithTargets, feature)
                .forEach(addOrUpdate, {map, value});
        }

        function addCurrentTargets(targets: Set<Node>, feature: Feature, featuresToApply) {
            const currTargets: void|Set<Node> = featureTargets.get(feature);
            currTargets && currTargets.forEach(targets.add, targets);
            if (targets.size === 0) return featuresToApply.delete(feature);
            targets.forEach(addFeaturesOfSameType, {map: featuresToApply, feature});
        }

        function onPopulateFeatureTargets(featuresToApply: Map<Feature, Set<Node>>) {
            // a feature's `args` have changed, so core wants all the DOM nodes that
            // were targeted by that feature. it's going to re-invoke the apply function
            // for each target node and -- if the return value has changed -- pass the
            // results to the plugin middleware to apply. for this reason, we also want
            // core to know about any other features of the same type that targeted the
            // same DOM node
            featuresToApply.forEach(addCurrentTargets);
        }

        return function handle(action: BootstrapAction|FeaturesAddedAction|PopulateFeatureTargetsAction) {
            switch (action.type) {
            case 'core:bootstrap':
                onBootstrap(action.payload);
                break;
            case 'core:features-added':
                onFeaturesAdded(action.payload);
                break;
            case 'core:populate-feature-targets':
                onPopulateFeatureTargets(action.payload);
                break;
            }
        };

    };

}

type Action = {
    meta?: {},
    type: string,
    payload: any
}

type Feature = {
    type: string,
    targets: string[]
}

type BootstrapAction = {
    type: 'core:bootstrap',
    payload: {
        target: HTMLElement
    }
};

type FeaturesAddedAction = {
    type: 'core:features-added',
    payload: Set<Feature>
};

type PopulateFeatureTargetsAction = {
    type: 'core:populate-feature-targets',
    payload: Map<Feature, Set<Node>>
};

type Dispatch = (action: Action) => void;

type AllowedAction =
    BootstrapAction |
    FeaturesAddedAction |
    PopulateFeatureTargetsAction

type AmaraBrowser = (dispatch: Dispatch) => (action: AllowedAction) => void;
