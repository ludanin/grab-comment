/**
 * Grabs the doc comment of any type or value given to this function
 *
 * @param nonType If the doc comment you're trying to grab is not a type
 * pass it here instead of using `typeof T`
 *
 *
 * ### Example
 *
 * ```tsx
 * // Only JS Docs are grabbed by grabDoc
 * const nonTypeNoDoc = 3
 * grabDoc(nonTypeNoDoc) // output: ''
 *
 * /** Doc comment to be grabbed *\/
 * type MyType = "union"
 * grabDoc<MyType>() // output: 'Doc comment to be grabbed'
 * ```
 */
export function grabDoc<T extends any>(nonType?: any): string
