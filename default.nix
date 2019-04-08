{
  pkgs ? import <nixpkgs> {}
}:
let
  stagingDir = pkgs.linkFarm "digitalmarketplace-logdia-stagingdir" ((map (s: { name = s; path = ./. + ("/" + s); }) [
    "default.nix"  # include self in archive for transparency purposes
    "background.js"
    "icon48.svg"
    "index.html"
    "LICENCE"
    "README.md"
    "logdia.js"
    "manifest.json"
    "xhr-monkeypatcher.js"
    # the repo-bundled copy of d3 is really just there to allow github pages to work and to ease development - by
    # default we omit it here
    # "d3.v4.js" 
  ]) ++ [
    # ...instead using a reproducibly-sourced, minified copy of d3
    {
      name = "d3.v4.js";
      path = pkgs.runCommand "d3.v4.min.js" {
        buildInputs = [ pkgs.unzip ];
        src = pkgs.fetchurl {
          url = "https://github.com/d3/d3/releases/download/v4.12.2/d3.zip";
          sha256 = "1x921sbmh0fr75kl9kw80x60q1vawq61988gbqrjvmxrxsk5gx0n";
        };
      } ''
        unzip $src
        cp d3.min.js $out
      '';
    }
  ]);
in {
  digitalmarketplace-logdia-xpi = pkgs.runCommand "digitalmarketplace-logdia.xpi" {
    buildInputs = [ pkgs.zip ];
  } ''
    pushd ${stagingDir}
    zip $out *
  '';
}
