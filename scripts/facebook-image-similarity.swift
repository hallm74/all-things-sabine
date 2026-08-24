import Foundation
import ImageIO
import Vision

var observations: [String: VNFeaturePrintObservation] = [:]

func featurePrint(for imagePath: String) throws -> VNFeaturePrintObservation {
    if let cached = observations[imagePath] {
        return cached
    }
    let url = URL(fileURLWithPath: imagePath)
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw NSError(domain: "FacebookImageSimilarity", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Could not decode \(imagePath)"
        ])
    }
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first as? VNFeaturePrintObservation else {
        throw NSError(domain: "FacebookImageSimilarity", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Could not create feature print for \(imagePath)"
        ])
    }
    observations[imagePath] = observation
    return observation
}

let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
for line in input.split(separator: "\n", omittingEmptySubsequences: true) {
    let fields = line.split(separator: "\t", maxSplits: 2, omittingEmptySubsequences: false).map(String.init)
    guard fields.count == 3 else { continue }
    do {
        let first = try featurePrint(for: fields[1])
        let second = try featurePrint(for: fields[2])
        var distance: Float = 0
        try first.computeDistance(&distance, to: second)
        print("\(fields[0])\t\(distance)\t\(fields[1])\t\(fields[2])")
    } catch {
        FileHandle.standardError.write(Data("\(fields[0])\tERROR\t\(error.localizedDescription)\n".utf8))
    }
}
