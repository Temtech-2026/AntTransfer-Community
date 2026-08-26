# Docker 镜像构建
# @author <a href="https://github.com/liyupi">程序员鱼皮</a>
# @from <a href="https://yupi.icu">编程导航知识星球</a>
# @modified 2026-08-26 技术栈升级：JDK 8 -> JDK 21（LTS）、Maven 3.8.1 -> 3.9.16
FROM maven:3.9.16-eclipse-temurin-21 as builder

# Copy local code to the container image.
WORKDIR /app
COPY pom.xml .
COPY src ./src

# Build a release artifact.
RUN mvn package -DskipTests

# Run the web service on container startup.
CMD ["java","-jar","/app/target/springboot-init-0.0.1-SNAPSHOT.jar","--spring.profiles.active=prod"]