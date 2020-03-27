// Copyright 2020 OpenStax Poland
// Licensed under the MIT license. See LICENSE file in the project root for
// full license text.

import { Editor, Element, Location, Path, Span, Node, Range, Text, Transforms } from 'slate'

import { isList, isListItem } from './interfaces'

/** Decrease depth of items in selection */
export function decreaseDepth(
    editor: Editor,
    options: {
        at?: Location,
    } = {},
): void {
    const { at = editor.selection } = options

    Transforms.liftNodes(editor, {
        at,
        match: isListItem,
        mode: 'lowest',
    })
}

/** Increase depth of items in selection */
export function increaseDepth(
    editor: Editor,
    options: {
        at?: Location,
    } = {},
): void {
    Editor.withoutNormalizing(editor, () => {
        const { at = editor.selection } = options

        const [[parent, parentPath]] = Editor.levels(editor, {
            at,
            match: n => isComplexBlock(editor, n) && !isListItem(n),
            reverse: true,
        })

        const spans = Array.from(
            spansToWrapInList(editor, parentPath, Editor.range(editor, at)),
            ([start, end]) => [
                Editor.pathRef(editor, start),
                Editor.pathRef(editor, end, { affinity: 'backward' }),
            ],
        )

        for (let [startRef, endRef] of spans) {
            const start = startRef.unref()
            const end = endRef.unref()
            const range = Editor.range(editor, start, end)
            const [parent] = Editor.node(editor, Path.parent(start))
            const match = n => parent.children.includes(n)

            const [prev, prevPath] = Editor.previous(editor, { at: start }) || []

            if (isList(prev)) {
                Transforms.moveNodes(editor, {
                    at: range,
                    to: prevPath.concat(prev.children.length),
                    match,
                })
                continue
            }

            const [next, nextPath] = Editor.next(editor, { at: end }) || []

            if (isList(next)) {
                Transforms.moveNodes(editor, {
                    at: range,
                    to: nextPath.concat(0),
                    match,
                })
                continue
            }

            Transforms.wrapNodes(editor, {
                type: 'list',
                children: [],
            }, { at: range, match })
        }
    })
}

/**
 * Check if a node is a non-inline element which contains other non-inline
 * elements
 */
function isComplexBlock(editor: Editor, node: Node): boolean {
    return (Editor.isEditor(node) || Element.isElement(node))
        && !Text.isText(node.children[0])
        && !Editor.isInline(editor, node.children[0])
}

/**
 * Yield a sequence of spans which need to be wrapped in lists to increase depth
 * of selection
 */
function *spansToWrapInList(editor, parentPath: Path, range: Range): Iterable<Span> {
    let start = null
    let end = null

    for (const [child, childPath] of Node.children(editor, parentPath)) {
        if (!Range.includes(range, childPath)) continue

        if (isList(child)) {
            if (start != null) {
                yield [start, end]
            }

            yield* spansToWrapInList(editor, childPath, range)

            start = end = null
            continue
        }

        if (start == null) {
            start = childPath
        }

        end = childPath
    }

    if (start != null) {
        yield [start, end]
    }
}