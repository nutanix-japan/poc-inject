# Welcome to MkDocs

For full documentation visit [mkdocs.org](https://www.mkdocs.org).

## Commands

* `mkdocs new [dir-name]` - Create a new project.
* `mkdocs serve` - Start the live-reloading docs server.
* `mkdocs build` - Build the documentation site.
* `mkdocs -h` - Print help message and exit.

## Project layout

    mkdocs.yml    # The configuration file.
    docs/
        index.md  # The documentation homepage.
        ...       # Other markdown pages, images and other files.

## Variables are here

# New format

# Lab Environment Details

This page shows live values from `labs.json`.

### User 1 Details (First Slot)

- **Email**: [[email]]
- **HPOC Cluster**: [[hpoc_cluster]]
- **Username**: [[username]]
- **Password**: [[password]]
- **Prism Central IP**: [[pc_ip]]
- **Prism Element IP**: [[pe_ip]]

### Connection Commands

```bash
# Example SSH command using variables
ssh [[username]]@[[pe_ip]]

# Or using cluster user
ssh [[cluster_user]]@[[pe_ip]]
