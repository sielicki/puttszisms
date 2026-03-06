{
  description = "Puttszisms - quote collection site on Cloudflare Workers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      bun2nix,
      ...
    }:
    let
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs
          [
            "x86_64-linux"
            "aarch64-linux"
            "x86_64-darwin"
            "aarch64-darwin"
          ]
          (
            system:
            f {
              pkgs = nixpkgs.legacyPackages.${system};
              inherit system;
            }
          );
    in
    {
      packages = forAllSystems (
        { pkgs, system }:
        {
          default = pkgs.callPackage ./default.nix {
            bun2nix = bun2nix.packages.${system}.default;
          };
        }
      );

      devShells = forAllSystems (
        { pkgs, system }:
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.bun
              pkgs.biome
              pkgs.git-cliff
              pkgs.nodePackages.typescript
              pkgs.nodePackages.wrangler
	      pkgs.openssl
              bun2nix.packages.${system}.default
            ];

            shellHook = ''
              echo "puttszisms dev shell"
              echo ""
              echo "  bun install                          - install deps"
              echo "  wrangler dev                         - local dev server"
              echo "  wrangler d1 execute puttszisms-db \\"
              echo "    --local --file=schema.sql          - init local D1"
              echo "  wrangler deploy                      - deploy to Cloudflare"
              echo "  bun2nix                              - regenerate bun.nix"
              echo ""

              # Create .dev.vars from template if it doesn't exist
              if [ ! -f .dev.vars ]; then
                cat > .dev.vars <<'EOF'
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_GUILD_ID=
JWT_SECRET=changeme
EOF
                echo "Created .dev.vars — fill in your Discord credentials for local dev."
              fi
            '';
          };
        }
      );
    };
}
