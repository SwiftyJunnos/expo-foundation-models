require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoFoundationModels'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '16.0',
    :tvos => '16.0'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/SwiftyJunnos/expo-foundation-models' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # Weak link FoundationModels framework for iOS 26+
  s.weak_frameworks = ['FoundationModels']

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
