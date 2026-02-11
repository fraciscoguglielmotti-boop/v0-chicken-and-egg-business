"use client"

import { parseSheetNumber } from "@/lib/utils"

export default function TestParserPage() {
  const testCases = [
    "$68,500",
    "$70,000",
    "$333,333",
    "68500",
    "70000",
    "333333",
    "$68.500",
    "$70.000",
    "$333.333",
    "1,234.56",
    "1.234,56",
    "1234",
    "",
    undefined,
    null,
  ]

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">parseSheetNumber Test</h1>
      <div className="space-y-2">
        {testCases.map((testCase, i) => {
          const result = parseSheetNumber(testCase as any)
          const displayInput = testCase === undefined ? "undefined" : testCase === null ? "null" : `"${testCase}"`
          return (
            <div key={i} className="flex gap-4 items-center border-b pb-2">
              <code className="text-sm flex-1">{displayInput}</code>
              <span className="text-muted-foreground">→</span>
              <code className="text-sm font-bold flex-1">{result}</code>
              <span className={`text-xs px-2 py-1 rounded ${result > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {result > 0 ? 'OK' : 'ZERO'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
