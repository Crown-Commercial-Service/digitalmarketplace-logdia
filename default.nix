{
  pkgs ? import <nixpkgs> {}
}:

let
  renderedIcon = svgIcon: size: pkgs.runCommand "out-${toString size}.png" {
    buildInputs = [ pkgs.inkscape ];
  } ''
    inkscape -z -C -h ${toString size} -f ${svgIcon} -e $out
  '';
in rec {
  stagingDir = pkgs.linkFarm "digitalmarketplace-logdia-stagingdir" ((map (s: { name = s; path = ./. + ("/" + s); }) [
    "default.nix"  # include self in archive for transparency purposes
    "background.js"
    "index.html"
    "LICENCE"
    "README.md"
    "logdia.js"
    "manifest.json"
    "xhr-monkeypatcher.js"
    # the repo-bundled copies of d3 & browser-polyfill are really just there to allow github pages to work and/or to
    # ease development - by default we omit them here:
    # "d3.v4.js"
    # "browser-polyfill.js"
  ]) ++ [
    # ...instead using reproducibly-sourced, minified copies of them
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
    {
      name = "browser-polyfill.js";
      path = pkgs.fetchurl {
        url = "https://unpkg.com/webextension-polyfill@0.4.0/dist/browser-polyfill.min.js";
        sha256 = "0d97xa5cnkzhlsv3gmm5a4kgqsfgglhspx9kv2ccmb22gqipywfc";
      };
    }
  ] ++ (map (size: {  # we also render multiple resolutions of icon as png because chrome can't handle svg icons
    name = "icons/digitalmarketplace-logdia-${toString size}.png";
    path = renderedIcon ./icons/digitalmarketplace-logdia-48.svg size;
  }) [16 19 24 38 48]));
  digitalmarketplace-logdia-xpi = pkgs.runCommand "digitalmarketplace-logdia.xpi" {
    buildInputs = [ pkgs.zip ];
  } ''
    pushd ${stagingDir}
    zip -r $out *
  '';
}
