[`FastAPI`](https://fastapi.tiangolo.com/) implementation under last `Python 3.11` with [Pipenv](https://pypi.org/project/pipenv/) as package manager.

It's based on [pydantic](https://pydantic-docs.helpmanual.io/), an essential component that allows proper OpenAPI generation and data validations while bringing advanced type hints.

Main packages involved :

* [pydantic](https://pydantic-docs.helpmanual.io/), data validation with Python 3.6+ type hints
* [SQLAlchemy](https://www.sqlalchemy.org/) v2 with [Alembic](https://alembic.sqlalchemy.org/en/latest/) for schema migration
* [python-jose](https://github.com/mpdavis/python-jose) as JWT implementation
* [Faker](https://faker.readthedocs.io/en/master/) as dummy data generator
* [autoflake](https://pypi.org/project/autoflake/) and [isort](https://pycqa.github.io/isort/) for clean imports
* [Flake8](https://flake8.pycqa.org/en/latest/) and [Black](https://black.readthedocs.io/en/stable/) as respective code linter and powerful code formatter
* [mypy](http://mypy-lang.org/) as advanced static analyzer
* [pytest](https://docs.pytest.org) as main test framework
