# Intro

Injecting variaables into md

## Run locally

1. Run the python server for the value load logic

```bash
cd poc-vars/backend
source venv/activate/bin

# Run the server
uvicorn main:app --reload --port 9000  
```

2. Run the backend Data insertion logic - from AG Grid to json for ``backend/app.py`` to read

```
cd admin-ui
npx serve .
```

3. Finally start the mkdocs server

```
cd docs-site\
mkdocs serve --livereload -o -a localhost:9011
```


