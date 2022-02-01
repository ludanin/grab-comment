import ts from "typescript"
import path from "path"

export default function transformer(
  program: ts.Program,
): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => (file: ts.SourceFile) =>
    visitNodeAndChildren(file, program, context)
}

function visitNodeAndChildren(
  node: ts.SourceFile,
  program: ts.Program,
  context: ts.TransformationContext,
): ts.SourceFile
function visitNodeAndChildren(
  node: ts.Node,
  program: ts.Program,
  context: ts.TransformationContext,
): ts.Node | undefined
function visitNodeAndChildren(
  node: ts.Node,
  program: ts.Program,
  context: ts.TransformationContext,
): ts.Node | undefined {
  return ts.visitEachChild(
    visitNode(node, program),
    (childNode) => visitNodeAndChildren(childNode, program, context),
    context,
  )
}

function visitNode(node: ts.SourceFile, program: ts.Program): ts.SourceFile
function visitNode(node: ts.Node, program: ts.Program): ts.Node | undefined
function visitNode(node: ts.Node, program: ts.Program): ts.Node | undefined {
  const typeChecker = program.getTypeChecker()

  if (isGrabDocImportExpression(node)) {
    return
  }
  if (!isGrabDocCallExpression(node, typeChecker)) {
    return node
  }

  if (!node.typeArguments?.length && !node.arguments?.length) {
    return ts.factory.createStringLiteral("")
  }

  const isType = !!node.typeArguments?.length
  const arg = isType ? node.typeArguments[0] : node.arguments[0]
  const symbol = (() => {
    // TODO check if more edge cases should be addressed
    if (!isType) {
      return typeChecker.getSymbolAtLocation(arg)
    }

    if (ts.isTypeReferenceNode(arg)) {
      return typeChecker.getSymbolAtLocation(arg.typeName)
    }

    if (ts.isIndexedAccessTypeNode(arg)) {
      const propName = arg.indexType.getFullText().replace(/'|"/g, "")
      return typeChecker.getTypeAtLocation(arg.objectType).getProperty(propName)
    }

    return typeChecker.getSymbolAtLocation(arg)
  })()

  const comments = (() => {
    try {
      return (
        symbol &&
        typeChecker
          .getAliasedSymbol(symbol)
          .getDocumentationComment(typeChecker)
      )
    } catch {
      return symbol?.getDocumentationComment(typeChecker)
    }
  })()

  return ts.factory.createStringLiteral((comments ?? [])[0]?.text ?? "")
}

// Copied from https://github.com/kimamula/ts-transformer-keys

const indexJs = path.join(__dirname, "index.js")
function isGrabDocImportExpression(
  node: ts.Node,
): node is ts.ImportDeclaration {
  if (!ts.isImportDeclaration(node)) {
    return false
  }
  const module = (node.moduleSpecifier as ts.StringLiteral).text
  try {
    return (
      indexJs ===
      (module.startsWith(".")
        ? require.resolve(
            path.resolve(path.dirname(node.getSourceFile().fileName), module),
          )
        : require.resolve(module))
    )
  } catch (e) {
    return false
  }
}

const indexTs = path.join(__dirname, "index.d.ts")
function isGrabDocCallExpression(
  node: ts.Node,
  typeChecker: ts.TypeChecker,
): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) {
    return false
  }
  const declaration = typeChecker.getResolvedSignature(node)?.declaration

  if (
    !declaration ||
    ts.isJSDocSignature(declaration) ||
    declaration.name?.getText() !== "grabDoc"
  ) {
    return false
  }
  try {
    // require.resolve is required to resolve symlink.
    // https://github.com/kimamula/ts-transformer-keys/issues/4#issuecomment-643734716
    return require.resolve(declaration.getSourceFile().fileName) === indexTs
  } catch {
    // declaration.getSourceFile().fileName may not be in Node.js require stack and require.resolve may result in an error.
    // https://github.com/kimamula/ts-transformer-keys/issues/47
    return false
  }
}
