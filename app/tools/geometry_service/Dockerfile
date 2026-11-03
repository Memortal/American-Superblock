# Requires an ALREADY PROVISIONED Python 3.12 native runtime image.
# No default remote image and no runtime/package bootstrap is supplied here.
# The host image must already contain usd-brep, compatible pxr and IfcOpenShell.
ARG GEOMETRY_RUNTIME_IMAGE
FROM ${GEOMETRY_RUNTIME_IMAGE}
WORKDIR /app
COPY --chown=10001:10001 engine.py service.py /app/
ENV PYTHONDONTWRITEBYTECODE=1 GEOMETRY_BIND=0.0.0.0 PORT=8090 GEOMETRY_STORAGE=/data
USER 10001:10001
EXPOSE 8090
CMD ["python3", "service.py"]
