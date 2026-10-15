FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline
COPY main ./main
COPY test ./test
RUN mvn -B -ntp package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN groupadd --system gamehub && useradd --system --gid gamehub gamehub
COPY --from=build /app/target/gamehub-api-16.0.0.jar ./app.jar
USER gamehub
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
