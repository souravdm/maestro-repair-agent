#!/usr/bin/env swift
// OCR Screen Text Detector using Apple Vision Framework
// Detects text regions in a screenshot and outputs JSON with text + bounding boxes.
// Used by the Maestro Recorder to supplement the accessibility hierarchy with
// OCR-detected elements (e.g. native tab bar labels invisible to maestro hierarchy).
//
// Usage: swift ocr-screen-text.swift <image-path> [--region y1,y2]
//   --region: Only return text within vertical pixel range (e.g. 860,943 for tab bar)
//   Output: JSON array of { text, x, y, width, height }

import Foundation
import Vision
import AppKit

struct OCRElement: Codable {
    let text: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}

guard CommandLine.arguments.count >= 2 else {
    let errorJSON = #"{"error": "Usage: ocr-screen-text.swift <image-path> [--region y1,y2]"}"#
    print(errorJSON)
    exit(1)
}

let imagePath = CommandLine.arguments[1]

// Parse optional --region flag
var regionY1: Int? = nil
var regionY2: Int? = nil
for i in 2..<CommandLine.arguments.count {
    if CommandLine.arguments[i] == "--region" && i + 1 < CommandLine.arguments.count {
        let parts = CommandLine.arguments[i + 1].split(separator: ",")
        if parts.count == 2, let y1 = Int(parts[0]), let y2 = Int(parts[1]) {
            regionY1 = y1
            regionY2 = y2
        }
    }
}

guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    let errorJSON = #"{"error": "Failed to load image"}"#
    print(errorJSON)
    exit(1)
}

let imageWidth = cgImage.width
let imageHeight = cgImage.height

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    let errorJSON = "{\"error\": \"Vision request failed: \(error.localizedDescription)\"}"
    print(errorJSON)
    exit(1)
}

var elements: [OCRElement] = []

if let observations = request.results {
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }

        let boundingBox = observation.boundingBox
        // Vision coordinates: origin at bottom-left, normalized 0-1
        let x = Int(boundingBox.origin.x * CGFloat(imageWidth))
        let y = Int((1.0 - boundingBox.origin.y - boundingBox.height) * CGFloat(imageHeight))
        let w = Int(boundingBox.width * CGFloat(imageWidth))
        let h = Int(boundingBox.height * CGFloat(imageHeight))

        // Apply region filter if specified
        if let ry1 = regionY1, let ry2 = regionY2 {
            let elementBottom = y + h
            // Element must overlap with the region
            if elementBottom < ry1 || y > ry2 {
                continue
            }
        }

        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty {
            elements.append(OCRElement(text: text, x: x, y: y, width: w, height: h))
        }
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = .prettyPrinted
if let jsonData = try? encoder.encode(elements),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
} else {
    print("[]")
}
