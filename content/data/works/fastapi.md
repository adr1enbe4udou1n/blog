[`FastAPI`](https://fastapi.tiangolo.com/) implementation under last `Python 3.12` with [Pipenv](https://pypi.org/project/pipenv/) as package manager.

It's based on [pydantic](https://pydantic-docs.helpmanual.io/), an essential component that allows proper OpenAPI generation and data validations while bringing advanced type hints.

Main packages involved :

* [Pydantic 2](https://pydantic-docs.helpmanual.io/), for any data validation
* [SQLAlchemy 2](https://www.sqlalchemy.org/) with [Alembic](https://alembic.sqlalchemy.org/en/latest/) for schema migration
* [python-jose](https://github.com/mpdavis/python-jose) as JWT implementation
* [Faker](https://faker.readthedocs.io/en/master/) as dummy data generator
* [Ruff](https://docs.astral.sh/ruff/) as extremely fast linter and code formatter written in rust, a perfect drop-in replacement for flake8, isort and black
* [mypy](http://mypy-lang.org/) as advanced static analyzer
* [pytest](https://docs.pytest.org) as main test framework
