digitalmarketplace-logdia
=========================

A single-page, self-contained app which generates interactive diagrams like this:

![Screenshot](screenshot.png)

given JSON logs from digitalmarketplace services. A statically-served version is available
[here](https://alphagov.github.io/digitalmarketplace-logdia) for convenience.

## WebExtension

This can also be built into a Web Extension for Firefox or Chrome. The build process is defined in the file `default.nix`,
which also pulls in clean versions of dependencies for reproducible builds.

Installing as a Web Extension allows users to generate log diagrams in a 1-click fashion direct from kibana. Firefox users
should be able to find an up to date, signed `.xpi` on the [releases page](https://github.com/alphagov/digitalmarketplace-logdia/releases), while Chrome users with an `@digital.cabinet-office.gov.uk` google account should be able to install 
it from the Chrome Web Store [here](https://chrome.google.com/webstore/detail/digitalmarketplace-logdia/ecjnilnplbacbhocaookjlfjffdgejjg)
