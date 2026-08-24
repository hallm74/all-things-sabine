import Foundation
import ImageIO
import Vision

let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
for line in input.split(separator: "\n", omittingEmptySubsequences: true) {
    let fields = line.split(separator: "\t", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
    guard fields.count == 2 else { continue }
    let url = URL(fileURLWithPath: fields[1])
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        FileHandle.standardError.write(Data("\(fields[0])\tCould not decode image\n".utf8))
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    do {
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        let text = (request.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: " ")
            .replacingOccurrences(of: "\t", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        print("\(fields[0])\t\(text)")
    } catch {
        FileHandle.standardError.write(Data("\(fields[0])\t\(error.localizedDescription)\n".utf8))
    }
}
